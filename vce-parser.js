(function (root) {
  'use strict';

  const decoder = new TextDecoder('utf-8');
  const marker = new TextEncoder().encode('-8 1 3 1');

  class VceImportError extends Error {
    constructor(message, code = 'invalid_vce') {
      super(message);
      this.name = 'VceImportError';
      this.code = code;
    }
  }

  class Reader {
    constructor(buffer) {
      this.bytes = new Uint8Array(buffer);
      this.view = new DataView(buffer);
      this.pos = 0;
    }
    ensure(size) {
      if (this.pos + size > this.bytes.length) throw new VceImportError('Het VCE-bestand is onvolledig of beschadigd.');
    }
    u8() { this.ensure(1); return this.bytes[this.pos++]; }
    i32() { this.ensure(4); const value = this.view.getInt32(this.pos, true); this.pos += 4; return value; }
    i64() { this.ensure(8); this.pos += 8; }
    take(size) {
      if (size < 0 || size > 25 * 1024 * 1024) throw new VceImportError('Het VCE-bestand bevat een ongeldige gegevenslengte.');
      this.ensure(size);
      const value = this.bytes.slice(this.pos, this.pos + size);
      this.pos += size;
      return value;
    }
  }

  function encodedLength(reader) {
    let current = reader.u8();
    const first = (current ^ (current ^ 0x80)) & 0xff;
    let state = (0x80 + first) | 0;
    const raw = new Uint8Array(4);
    for (let index = 0; index < 4; index++) {
      current = reader.u8();
      raw[index] = (state ^ current) & 0xff;
      const next = (current ^ (state ^ current)) & 0xff;
      state = (state + next) | (index + 1);
    }
    return new DataView(raw.buffer).getInt32(0, true);
  }

  function plainArray(reader) { return reader.take(encodedLength(reader)); }

  function skipEncryptedArray(reader, version) {
    let length = encodedLength(reader);
    if (!length) return;
    reader.u8();
    length -= 1;
    if (version >= 61) { reader.i32(); length -= 4; }
    reader.take(length);
  }

  async function decryptArray(reader, context) {
    let length = encodedLength(reader);
    if (length === 0) return new Uint8Array();
    const selector = reader.u8();
    length -= 1;
    let offset = 0;
    if (context.version >= 61) {
      offset = reader.i32();
      length -= 4;
    }
    if (selector >= 0x80) {
      throw new VceImportError('Dit beveiligde VCE-bestand vereist een externe Avanset-ontgrendelsleutel. Ontsluit het bestand eerst met de officiële VCE Simulator; deze webapp kan de beveiligde inhoud niet zelfstandig lezen.', 'protected_vce');
    }
    if (offset < 0 || offset + 48 > context.keys.length) throw new VceImportError('De interne VCE-sleutel is ongeldig.');
    const encrypted = reader.take(length);
    if (!encrypted.length || encrypted.length % 16) throw new VceImportError('De versleutelde VCE-inhoud heeft een ongeldige lengte.');
    try {
      const key = await crypto.subtle.importKey('raw', context.keys.slice(offset, offset + 32), { name: 'AES-CBC' }, false, ['decrypt']);
      const result = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: context.keys.slice(offset + 32, offset + 48) }, key, encrypted);
      return new Uint8Array(result);
    } catch (error) {
      throw new VceImportError('De VCE-inhoud kon niet worden ontsleuteld.', 'decrypt_failed');
    }
  }

  function cleanString(bytes) {
    return decoder.decode(bytes).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  }

  function findMarker(bytes, start) {
    outer: for (let i = start; i <= bytes.length - marker.length; i++) {
      for (let j = 0; j < marker.length; j++) if (bytes[i + j] !== marker[j]) continue outer;
      return i;
    }
    return -1;
  }

  function splitMarker(bytes) {
    const parts = [];
    let start = 0;
    for (;;) {
      const found = findMarker(bytes, start);
      if (found < 0) { parts.push(bytes.slice(start)); break; }
      parts.push(bytes.slice(start, found));
      start = found + marker.length;
    }
    return parts;
  }

  function readableText(bytes) {
    let value = cleanString(bytes)
      .replace(/T(?:JPEG|Png)Image[\s\S]*$/g, '[Afbeelding uit VCE niet weergegeven]')
      .replace(/(?:^|\r?\n)-?\d+(?:\s+-?\d+){4,9}(?:\s+"[^"]*")?/g, '\n')
      .replace(/\)\s+-?\d+(?:\s+-?\d+){4,9}(?:\s+"[^"]*")?/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return value.replace(/^\)+|\)+$/g, '').trim();
  }

  function formattedQuestion(bytes, variantsCount) {
    const parts = splitMarker(bytes);
    // VCE stores a formatting preamble, then the stem, variants and reference.
    const content = parts.slice(1).map(readableText);
    if (content.length < variantsCount + 1) throw new VceImportError('Een vraag in het VCE-bestand kon niet worden gelezen.');
    return {
      stem: content[0],
      options: content.slice(1, variantsCount + 1),
      reference: content.slice(variantsCount + 1).filter(Boolean).join('\n'),
    };
  }

  function answerIndexes(bytes, optionCount) {
    const letters = cleanString(bytes).toUpperCase().replace(/[^A-Z]/g, '');
    const indexes = [...new Set([...letters].map(letter => letter.charCodeAt(0) - 65).filter(value => value >= 0 && value < optionCount))];
    if (!indexes.length) throw new VceImportError('Bij een VCE-vraag ontbreekt het juiste antwoord.');
    return indexes;
  }

  function hotAreaQuestion(questionBytes, variantsBytes, answersBytes, imageBytes) {
    if (variantsBytes.length < 4 || answersBytes.length < 4) throw new VceImportError('Een hotspotvraag is onvolledig.');
    const variants = new DataView(variantsBytes.buffer, variantsBytes.byteOffset, variantsBytes.byteLength);
    const answers = new DataView(answersBytes.buffer, answersBytes.byteOffset, answersBytes.byteLength);
    const count = variants.getInt32(0, true);
    if (count < 2 || count > 20 || variantsBytes.length < 4 + count * 16 || answers.getInt32(0, true) !== count || answersBytes.length < 4 + count) {
      throw new VceImportError('Een hotspotvraag bevat ongeldige antwoordgebieden.');
    }
    const options = [];
    const correct = [];
    for (let index = 0; index < count; index++) {
      const offset = 4 + index * 16;
      const left = variants.getInt32(offset, true);
      const top = variants.getInt32(offset + 4, true);
      const right = variants.getInt32(offset + 8, true);
      const bottom = variants.getInt32(offset + 12, true);
      options.push(`Gebied ${index + 1} (x ${left}–${right}, y ${top}–${bottom})`);
      if (answersBytes[4 + index] === 1) correct.push(index);
    }
    if (!correct.length) throw new VceImportError('Bij een hotspotvraag ontbreekt het juiste antwoord.');
    const textParts = splitMarker(questionBytes).slice(1).map(readableText).filter(Boolean);
    const signature = [...imageBytes.slice(0, 4)].map(value => value.toString(16).padStart(2, '0')).join('');
    const mime = signature.startsWith('89504e47') ? 'image/png' : signature.startsWith('ffd8ff') ? 'image/jpeg' : 'image/png';
    let binary = '';
    for (let start = 0; start < imageBytes.length; start += 0x8000) binary += String.fromCharCode(...imageBytes.slice(start, start + 0x8000));
    return {
      stem: textParts[0] || 'Selecteer het juiste gebied in de afbeelding.',
      options,
      correct,
      explanation: textParts.slice(1).join('\n') || 'Geen uitleg opgenomen in het VCE-bestand.',
      image: `data:${mime};base64,${btoa(binary)}`,
    };
  }

  async function readQuestions(reader, context, count, questions) {
    for (let index = 0; index < count; index++) {
      if (context.version >= 61) encodedLength(reader);
      skipEncryptedArray(reader, context.version); // internal question identifier is not needed for import
      const type = reader.u8();
      reader.i32(); // section id
      reader.i32(); // complexity
      reader.i32(); // unknown
      if (type !== 0 && type !== 1 && type !== 9) {
        const names = { 2: 'slepen en neerzetten', 8: 'invulvraag', 9: 'hotspotvraag' };
        throw new VceImportError(`Vraagtype “${names[type] || type}” wordt nog niet ondersteund door deze webtoets.`, 'unsupported_question_type');
      }
      if (type === 9) {
        const variantsBytes = await decryptArray(reader, context);
        const answersBytes = await decryptArray(reader, context);
        const questionBytes = await decryptArray(reader, context);
        reader.u8(); reader.u8();
        const imageBytes = await decryptArray(reader, context);
        questions.push(hotAreaQuestion(questionBytes, variantsBytes, answersBytes, imageBytes));
      } else {
        const questionBytes = await decryptArray(reader, context);
        const answersBytes = await decryptArray(reader, context);
        const variantsCount = reader.i32();
        if (variantsCount < 2 || variantsCount > 20) throw new VceImportError('Een VCE-vraag heeft een ongeldig aantal antwoordopties.');
        reader.u8(); reader.u8(); reader.u8();
        await decryptArray(reader, context);
        const parsed = formattedQuestion(questionBytes, variantsCount);
        if (!parsed.stem || parsed.options.some(option => !option)) throw new VceImportError('Een VCE-vraag bevat lege tekst of antwoordopties.');
        questions.push({
          stem: parsed.stem,
          options: parsed.options,
          correct: answerIndexes(answersBytes, variantsCount),
          explanation: parsed.reference || 'Geen uitleg opgenomen in het VCE-bestand.',
        });
      }
    }
  }

  async function parseVce(buffer, filename = 'Geïmporteerde VCE-toets') {
    if (!(buffer instanceof ArrayBuffer)) throw new VceImportError('Selecteer een geldig VCE-bestand.');
    if (buffer.byteLength > 20 * 1024 * 1024) throw new VceImportError('Het VCE-bestand is groter dan 20 MB.');
    const reader = new Reader(buffer);
    if (reader.u8() !== 0x85 || reader.u8() !== 0xa8) throw new VceImportError('Dit bestand heeft geen ondersteunde VCE-header.');
    const context = { version: reader.u8() * 10 + reader.u8(), keys: null };
    if (context.version !== 62) throw new VceImportError(`VCE-versie ${context.version} wordt niet ondersteund; deze importer ondersteunt versie 62.`);
    reader.i32();
    context.keys = plainArray(reader);
    plainArray(reader); // encrypted external key block
    reader.u8();
    const number = cleanString(await decryptArray(reader, context));
    const title = cleanString(await decryptArray(reader, context));
    const passingScore = reader.i32();
    const timeLimit = reader.i32();
    await decryptArray(reader, context); // file version
    reader.i64(); reader.i64();
    await decryptArray(reader, context); // styles
    await decryptArray(reader, context); // description
    const sectionCount = reader.i32();
    if (sectionCount < 0 || sectionCount > 1000) throw new VceImportError('Het VCE-bestand bevat een ongeldig aantal secties.');
    for (let i = 0; i < sectionCount; i++) { reader.i32(); await decryptArray(reader, context); }
    await decryptArray(reader, context);
    const examCount = reader.i32();
    if (examCount < 1 || examCount > 100) throw new VceImportError('Het VCE-bestand bevat geen geldige examens.');
    const questions = [];
    for (let examIndex = 0; examIndex < examCount; examIndex++) {
      const examType = reader.u8();
      await decryptArray(reader, context); // exam name
      if (examType === 0) {
        await readQuestions(reader, context, reader.i32(), questions);
      } else if (examType === 1) {
        const examSectionCount = reader.i32();
        for (let sectionIndex = 0; sectionIndex < examSectionCount; sectionIndex++) {
          const sectionType = reader.u8();
          reader.i32();
          if (sectionType === 0) {
            await readQuestions(reader, context, reader.i32(), questions);
          } else if (sectionType === 1) {
            await decryptArray(reader, context); reader.i32(); await decryptArray(reader, context); await decryptArray(reader, context); reader.i32();
            await readQuestions(reader, context, reader.i32(), questions);
          } else throw new VceImportError('Het VCE-bestand bevat een onbekend sectietype.');
        }
      } else throw new VceImportError('Het VCE-bestand bevat een onbekend examentype.');
    }
    const declaredLength = reader.i32();
    if (declaredLength !== reader.bytes.length || reader.pos !== reader.bytes.length) throw new VceImportError('De VCE-bestandslengte klopt niet; het bestand kan beschadigd zijn.');
    if (!questions.length) throw new VceImportError('Er zijn geen ondersteunde vragen in dit VCE-bestand gevonden.');
    return {
      title: title || number || filename.replace(/\.vce$/i, ''),
      examNumber: number,
      passingScore,
      timeLimit,
      version: context.version,
      questions,
    };
  }

  root.VceImporter = { parseVce, VceImportError };
})(typeof globalThis !== 'undefined' ? globalThis : window);

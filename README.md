# Microsoft Data Certification Exam Trainer

An independent, extensible practice platform for Microsoft DP certification exams. The current exam tracks are DP-600, DP-700, DP-800, and DP-900. Learners choose an exam first, then practice with exam-specific question banks, domains, study links, and progress tracking.

The platform uses PocketBase for accounts, progress sync, and administrator features. It is not an official Microsoft product, and its practice questions are original learning material rather than official or leaked exam questions.

## Exam coverage

| Exam | Focus | Question bank status |
|---|---|---|
| DP-600 | Analytics engineering and Microsoft Fabric | 18 original practice questions across the current exam domains |
| DP-700 | Data engineering in Microsoft Fabric | 102 practice questions across the current exam domains |
| DP-800 | AI-enabled database development | 18 original practice questions across the current exam domains |
| DP-900 | Data fundamentals | 18 original practice questions across the current exam domains |

Questions are newly written and are not copied from real exams, dumps, or recalled test items. Each question links to the relevant Microsoft exam objectives and, where useful, additional technical material from sources such as SQLBI, Apache, PostgreSQL, GitHub samples, and Microsoft Fabric Community. Exam objectives and study guides can change, so use the linked official material as the current scope checklist. Practice results are not official Microsoft exam scores.

## Features

- Exam selection tiles explain the intended audience and focus of each certification.
- Study mode gives immediate feedback; exam simulation is timed and uses the selected exam's configuration.
- Profiles keep progress separate for each exam and sync it across devices after sign-in.
- Administrators can review accounts, sign-in attempts, and recent high-level learning activity.
- Administrators can import supported VCE files; parsing takes place in the browser.
- Dutch and English interface text is available.

The activity view records the selected exam, a broad activity label, and the latest heartbeat. It does not record answer choices or question content. Tell learners about this monitoring and apply an appropriate retention policy.

## Docker deployment

The Compose deployment stores PocketBase data in a persistent named volume. Rebuilding or recreating the container keeps that volume and its account and progress data.

### First-time setup

For a private repository, configure a read-only GitHub deploy key on the Docker host. Clone the repository into your chosen deployment directory, then run:

```sh
git clone <repository-ssh-url> <deployment-directory>
cd <deployment-directory>
./deploy.sh
```

If an older Compose deployment is running from another directory, stop that service before starting the new checkout. Do not add `-v` to `docker compose down`; that would remove the persistent data volume.

### Updating

From the repository checkout, run:

```sh
./deploy.sh
```

The script checks that the checkout is on `main` and has no local changes, fetches and fast-forwards from GitHub, builds the image, recreates the service, verifies the app files inside the container, and prints the service status and recent logs. It stops with an explanation if the checkout is dirty or has diverged from `origin/main`.

Configure the existing reverse proxy to reach the app using the port defined in the Compose file. Keep the PocketBase superuser interface restricted to trusted administrative access; do not expose it directly to the public internet.

### PocketBase data and backups

PocketBase runs versioned collection migrations when the container starts. The named volume persists users and learning progress. Back up this volume before upgrades and test that a backup can be restored.

## Accounts and administration

Learners can practice without an account, but their progress will not sync between devices. Signed-in users can see their own progress by exam in the profile.

To grant administrator access, create the account through the app and set its `role` field to `admin` through the restricted PocketBase superuser interface. Regular users cannot change their own role. The app's administrator page is restricted to accounts with the admin role.

## VCE import

Administrators can import VCE files up to 20 MB. The browser parses the file and only the normalized questions are stored in PocketBase. Single-choice, multiple-choice, and hotspot questions are supported. Some encrypted VCE files require an Avanset unlock key and cannot be parsed directly.

## Adding an exam track

The exam catalogue and per-exam settings are in `certifications.js`. The starter question banks are in `questions-extra.js`; expanded original questions are in `questions-expanded.js`, and the established DP-700 question bank remains embedded in `index.html`. To add a track, define its code, title, audience, description, exam domains, official study guide, and simulation duration, then add original questions with explanations and both objective and technical source links. Extend the smoke tests to check the bank and its domain coverage.

The chooser, quiz flow, profile progress, and administrator activity view read the exam configuration dynamically. New tracks can therefore use the shared platform without adding exam-specific branding to the general pages.

## Local checks

Run these from the repository root:

```sh
sh -n deploy.sh
node --check certifications.js
node --check questions-extra.js
node --check questions-expanded.js
node --check pb_hooks/auth_audit.pb.js
node --check pb_migrations/1793568000_admin_and_imported_exams.js
node --check pb_migrations/1793570000_learning_activity.js
node --test tests/*.test.cjs
docker compose build
```

GitHub Actions runs the syntax checks, smoke tests, and a Docker image build on pushes to `main` and pull requests.

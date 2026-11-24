# ProjectDB skill for Codex

Описание и руководство также доступны [на русском языке](README.ru.md).

**ProjectDB skill for Codex** helps you develop and review ProjectDB templates and modules while preserving the platform's existing contracts. It covers Twig templates, JSON configuration, CSS, modular JavaScript, resource inheritance, manual assembly with `project-map.json`, and technical SEO checks for ProjectDB sites and migrations.

The plugin includes the `projectdb-constructor` skill, reference material and small contract examples. The skill's instructions are written in Russian.

## What you need

Use the skill in Codex with access to your ProjectDB project sources and base components. Provide the task and the project's own instructions, configuration and examples so Codex can work with the installed APIs and library versions.

## Installation

Choose one installation method for personal use or a shared workspace.

### Personal use: plugin

In a Codex client that supports plugin marketplaces, add this source:

```text
codex plugin marketplace add pavel-elblaus/codex-projectdb-skill --ref main
```

Open the application's plugin directory, select the **ProjectDB for Codex** source and install **ProjectDB for Codex**. Restart the application if the source does not appear.

### Personal use: standalone skill

To install the skill directly, ask Codex:

> Use $skill-installer to install the skill from https://github.com/pavel-elblaus/codex-projectdb-skill/tree/main/plugins/projectdb/skills/projectdb-constructor.

This installs a local copy of the skill. Choose either the plugin or the standalone skill to avoid two entries with the same skill name.

### Teams: workspace plugin

A workspace administrator can import the repository and make the plugin available to members. Import it separately into each workspace that needs access.

1. Open [Admin Console](https://admin.openai.com), select the workspace and go to **Plugins → Add → Import marketplace**.
2. Set **Source** to `https://github.com/pavel-elblaus/codex-projectdb-skill`.
3. Leave **Path** empty.
4. Set **Branch, tag, or commit** to **`main`** to receive future updates.
5. Select **Import marketplace** and complete the GitHub sign-in if prompted.
6. Find **ProjectDB for Codex** and configure its installation policy: **Available** for members to install, or **Installed** for eligible roles where supported.
7. Members install the plugin unless it has been assigned automatically.

Availability depends on the workspace's settings and permissions. See the [official marketplace import and sync guide](https://help.openai.com/en/articles/20001504-importing-and-syncing-plugin-marketplaces-from-github).

## Usage

Select **ProjectDB for Codex** from the available plugins and describe the task. For example:

> Use the projectdb-constructor skill. Read the project's AGENTS.md and update the ProjectDB module while preserving its input data and existing contracts.

In local clients with skill selection, you can explicitly invoke `$projectdb-constructor`.

## Updates

For a personal plugin installation, refresh the marketplace source:

```text
codex plugin marketplace upgrade pavel-projectdb-skills
```

For a standalone installation, ask Codex to update the installed skill from the same GitHub source.

Daily update checks are enabled by default after import. To request an earlier update, an administrator can open **Plugins → Marketplaces → ProjectDB for Codex → Sync now**. Keep the imported source on the `main` branch to receive new versions.

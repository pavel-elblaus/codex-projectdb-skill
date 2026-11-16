import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillFiles, listFiles, checkPublicText } from './skill-package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const plugin = path.join(root, 'plugins/projectdb');
const skill = path.join(plugin, 'skills/projectdb-constructor');
const read = async (relative) => readFile(path.join(root, relative), 'utf8');

try {
	const catalog = JSON.parse(await read('.agents/plugins/marketplace.json'));
	assert.equal(catalog.name, 'pavel-projectdb-skills');
	assert.equal(catalog.plugins.length, 1);
	const entry = catalog.plugins[0];
	assert.equal(entry.name, 'projectdb');
	assert.deepEqual(entry.source, { source: 'local', path: './plugins/projectdb' });
	assert.deepEqual(entry.policy, { installation: 'AVAILABLE', authentication: 'ON_INSTALL' });
	assert.equal(typeof entry.category, 'string');
	const manifest = JSON.parse(await read('plugins/projectdb/plugin.json'));
	assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
	assert.equal(manifest.name, entry.name);
	assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
	assert.equal(manifest.repository, 'https://github.com/pavel-elblaus/codex-projectdb-skill');
	assert.ok(manifest.description && manifest.author.name && manifest.extensions['com.openai'].interface.displayName);
	assert.ok(!manifest.extensions['com.openai'].apps && !manifest.extensions['com.openai'].hooks);
	const files = await listFiles(skill);
	assert.deepEqual(files, [...skillFiles].sort(), 'Skill files must match the reviewed package list.');
	let links = 0;
	for (const relative of files) {
		const text = await readFile(path.join(skill, relative), 'utf8');
		assert.ok(!text.startsWith('\uFEFF'), `${relative}: UTF-8 BOM`);
		assert.ok(!text.includes('\r'), `${relative}: expected LF`);
		checkPublicText(relative, text);
		if (relative.endsWith('.json')) JSON.parse(text);
		if (relative.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(skill, relative)], { stdio: 'pipe' });
		if (relative.endsWith('.md')) {
			for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
				const target = match[1].split('#')[0];
				if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
				const resolved = path.resolve(path.dirname(path.join(skill, relative)), decodeURIComponent(target));
				const within = path.relative(skill, resolved);
				assert.ok(within && !within.startsWith('..') && !path.isAbsolute(within), `${relative}: link leaves the skill`);
				assert.ok((await stat(resolved)).isFile(), `${relative}: broken link ${target}`);
				links++;
			}
		}
	}
	const frontmatter = (await readFile(path.join(skill, 'SKILL.md'), 'utf8')).match(/^---\n([\s\S]+?)\n---\n/);
	assert.ok(frontmatter, 'Missing skill frontmatter');
	assert.match(frontmatter[1], /^name: projectdb-constructor$/m);
	assert.match(frontmatter[1], /^description: .{20,}$/m);
	assert.match(await readFile(path.join(skill, 'agents/openai.yaml'), 'utf8'), /\$projectdb-constructor/);
	for (const script of ['skill-package.mjs', 'publish.mjs', 'validate.mjs', 'test-publish.mjs']) {
		execFileSync(process.execPath, ['--check', path.join(root, 'scripts', script)], { stdio: 'pipe' });
	}
	console.log(`Validated ProjectDB ${manifest.version}: marketplace, plugin manifest, ${files.length} skill files, ${links} local links and JavaScript syntax.`);
} catch (error) {
	console.error(`Validation failed: ${error.message}`);
	process.exitCode = 1;
}

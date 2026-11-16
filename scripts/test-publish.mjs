import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, appendFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'projectdb-publish-test-'));
const fixture = path.join(temporary, 'repo');
const remote = path.join(temporary, 'remote.git').split(path.sep).join('/');
const git = (args) => execFileSync('git', args, { cwd: fixture, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const publish = (...args) => spawnSync(process.execPath, ['scripts/publish.mjs', ...args], { cwd: fixture, encoding: 'utf8' });
const success = (result) => assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

try {
	await cp(root, fixture, { recursive: true, filter: (source) => !path.relative(root, source).split(path.sep).includes('.git') });
	git(['init', '--initial-branch=main']);
	git(['config', 'user.name', 'Publisher test']);
	git(['config', 'user.email', 'test@example.invalid']);
	git(['config', 'projectdb.autoPublish', 'true']);
	git(['add', '--all']);
	git(['commit', '-m', 'Test baseline']);
	git(['init', '--bare', remote]);
	const manifestFile = path.join(fixture, 'plugins/projectdb/plugin.json');
	const before = JSON.parse(await readFile(manifestFile, 'utf8'));
	const origin = `${before.repository}.git`;
	git(['remote', 'add', 'origin', origin]);
	git(['config', `url.${remote}.insteadOf`, origin]);
	git(['push', 'origin', 'main']);
	const firstHead = git(['rev-parse', 'HEAD']);
	success(publish('--auto'));
	assert.equal(git(['rev-parse', 'HEAD']), firstHead, 'No-change publication must not create a commit.');
	const skillFile = path.join(fixture, 'plugins/projectdb/skills/projectdb-constructor/SKILL.md');
	await appendFile(skillFile, '\nПроверять согласованность общих правил.\n');
	success(publish('--auto', '--check'));
	assert.equal(JSON.parse(await readFile(manifestFile, 'utf8')).version, before.version, 'Check must not change the version.');
	success(publish('--auto'));
	const expected = before.version.split('.').map(Number);
	expected[2]++;
	assert.equal(JSON.parse(await readFile(manifestFile, 'utf8')).version, expected.join('.'));
	assert.equal(git(['status', '--porcelain']), '', 'Published checkout must be clean.');
	assert.equal(git(['rev-parse', 'HEAD']), git([`--git-dir=${remote}`, 'rev-parse', 'refs/heads/main']));
	const safeHead = git(['rev-parse', 'HEAD']);
	await appendFile(skillFile, '\nhttps://example.invalid\n');
	assert.notEqual(publish('--auto').status, 0, 'A site address in the skill must stop publication.');
	assert.equal(git([`--git-dir=${remote}`, 'rev-parse', 'refs/heads/main']), safeHead);
	console.log('Publisher verified: no-op, dry run, version increase, commit, local push and address rejection.');
} finally {
	assert.ok(path.resolve(temporary).startsWith(path.resolve(tmpdir()) + path.sep));
	assert.ok(path.basename(temporary).startsWith('projectdb-publish-test-'));
	await rm(temporary, { recursive: true, force: true });
}

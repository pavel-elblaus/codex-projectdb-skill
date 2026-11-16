import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, realpath, writeFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.platform, 'win32', 'Setup verification runs on Windows.');
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'projectdb-setup-test-'));
const fixture = path.join(temporary, 'repo');
const remote = path.join(temporary, 'remote.git').split(path.sep).join('/');
const skills = path.join(temporary, 'skills');
const installed = path.join(skills, 'projectdb-constructor');
const git = (args) => execFileSync('git', args, { cwd: fixture, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

try {
	await cp(root, fixture, { recursive: true, filter: (source) => !path.relative(root, source).split(path.sep).includes('.git') });
	git(['init', '--initial-branch=main']);
	git(['config', 'user.name', 'Setup test']);
	git(['config', 'user.email', 'test@example.invalid']);
	git(['add', '--all']);
	git(['commit', '-m', 'Test baseline']);
	git(['init', '--bare', remote]);
	const manifest = JSON.parse(await readFile(path.join(fixture, 'plugins/projectdb/plugin.json'), 'utf8'));
	const origin = `${manifest.repository}.git`;
	git(['remote', 'add', 'origin', origin]);
	git(['config', `url.${remote}.insteadOf`, origin]);
	git(['push', 'origin', 'main']);
	git(['update-ref', '-d', 'refs/heads/main']);
	await mkdir(installed, { recursive: true });
	await writeFile(path.join(installed, 'SKILL.md'), 'Previous installed skill.');
	const runSetup = () => spawnSync('powershell.exe', [
		'-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(fixture, 'scripts/setup-author.ps1'), '-SkillHome', skills,
	], {
		cwd: temporary, encoding: 'utf8',
		env: { ...process.env, GIT_TEST_ASSUME_DIFFERENT_OWNER: '1', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: remote },
	});
	const first = runSetup();
	assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
	const source = path.join(fixture, 'plugins/projectdb/skills/projectdb-constructor');
	assert.equal((await realpath(installed)).toLowerCase(), (await realpath(source)).toLowerCase());
	assert.equal(git(['config', '--get', 'projectdb.autoPublish']), 'true');
	assert.equal(git(['status', '--porcelain']), '');
	const backups = path.join(temporary, 'skill-backups');
	const entries = await readdir(backups);
	assert.equal(entries.length, 1);
	assert.equal(await readFile(path.join(backups, entries[0], 'SKILL.md'), 'utf8'), 'Previous installed skill.');
	const second = runSetup();
	assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
	assert.deepEqual(await readdir(backups), entries);
	console.log('Windows setup verified: different owner, initial fetch, backup, junction, author mode and repeated setup.');
} finally {
	assert.ok(path.resolve(temporary).startsWith(path.resolve(tmpdir()) + path.sep));
	assert.ok(path.basename(temporary).startsWith('projectdb-setup-test-'));
	await rm(temporary, { recursive: true, force: true });
}

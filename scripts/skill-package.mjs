import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

export const skillFiles = [
	'SKILL.md',
	'agents/openai.yaml',
	'examples/form2-theme.js',
	'examples/status.js',
	'examples/status.js.json',
	'references/base-components.md',
	'references/javascript.md',
	'references/projectdb-rules.md',
	'references/seo.md',
];

export async function listFiles(root, prefix = '') {
	const files = [];
	for (const entry of await readdir(root, { withFileTypes: true })) {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		const absolute = path.join(root, entry.name);
		if ((await lstat(absolute)).isSymbolicLink()) throw new Error(`Symlink is not packaged: ${relative}`);
		if (entry.isDirectory()) files.push(...await listFiles(absolute, relative));
		else if (entry.isFile()) files.push(relative);
		else throw new Error(`Unsupported file: ${relative}`);
	}
	return files.sort();
}

export function checkPublicText(relative, text) {
	const checks = [
		[/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/, 'credential-like value'],
		[/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/, 'private key'],
		[/\b[A-Z]:[\\/]|\/(?:Users|home)\/[A-Za-z0-9_.-]+\//i, 'absolute user path'],
		[/https?:\/\/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, 'site address or email'],
		[/Владелец разрешил (?:обновлять этот навык|актуализировать навык)/, 'personal permission'],
	];
	for (const [pattern, label] of checks) {
		if (pattern.test(text)) throw new Error(`${relative}: review ${label} before publishing`);
	}
}

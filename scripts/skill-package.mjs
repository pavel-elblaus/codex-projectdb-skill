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

function replaceOnce(text, pattern, replacement, label) {
	const matches = [...text.matchAll(new RegExp(pattern.source, 'gm'))];
	if (matches.length !== 1) throw new Error(`Review public adaptation for ${label}: expected one match, got ${matches.length}`);
	return text.replace(pattern, replacement);
}

export function publicCopy(relative, source) {
	let text = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
	if (relative === 'SKILL.md') {
		text = replaceOnce(text,
			/^Владелец разрешил обновлять этот навык.*?без отдельного напоминания\./m,
			'Актуализировать исходный навык при наличии разрешения владельца текущего рабочего окружения. Для установленной копии плагина готовить предложения к исходному репозиторию; не изменять кеш установки.',
			'SKILL.md update permission');
	}
	if (relative === 'references/projectdb-rules.md') {
		text = replaceOnce(text,
			/^Примеры, предоставленные владельцем и проверенные .*$/m,
			'Образцы rufont.css, ruimage.css, rustyle.css, ruscript.js и app.js брать из текущего проекта и проверять по установленной версии. Это системный результат; образцы другого сайта не являются зависимостями нового проекта.',
			'project-specific cache URLs');
		text = replaceOnce(text,
			/^Владелец разрешил актуализировать навык .*$/m,
			'Актуализировать исходный навык по подтверждённым знаниям о подготовке, описании, наследовании, сборке и проверке модулей, если это разрешил владелец текущего рабочего окружения. Для установленного плагина предлагать изменения в исходный репозиторий. Публикацию изменений выполнять по указанию владельца репозитория.',
			'reference update permission');
		text = replaceOnce(text,
			/Уточнение подтверждённого правила не требует нового вопроса владельцу; технические разрешения среды сохраняются\./,
			'Учитывать действующие указания владельца и технические разрешения среды.',
			'reference permission scope');
	}
	if (relative === 'references/javascript.md') text = text.replaceAll('talmayScroll', 'pageScroll');
	return text;
}

export function checkPublicText(relative, text) {
	const checks = [
		[/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/, 'credential-like value'],
		[/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/, 'private key'],
		[/\b[A-Z]:[\\/]|\/(?:Users|home)\/[A-Za-z0-9_.-]+\//i, 'absolute user path'],
		[/\b(?:oillab\.ru|talmayScroll)\b/i, 'project-specific example'],
		[/Владелец разрешил (?:обновлять этот навык|актуализировать навык)/, 'personal permission'],
	];
	for (const [pattern, label] of checks) {
		if (pattern.test(text)) throw new Error(`${relative}: review ${label} before publishing`);
	}
}

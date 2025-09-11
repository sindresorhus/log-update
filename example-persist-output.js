#!/usr/bin/env node
import {setTimeout as delay} from 'node:timers/promises';
import chalk from 'chalk';
import logUpdate from './index.js';

console.log(chalk.magenta('\n✨ Welcome to the magical log-update demo! ✨\n'));

const rainbowColors = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
const sparkles = ['✨', '💫', '⭐', '🌟', '✨', '💖'];
const unicorns = ['🦄', '🦄', '🦄'];

// Phase 1: Rainbow spinner
console.log(chalk.cyan('🌈 Phase 1: Rainbow spinner that updates in place!\n'));

let frame = 0;
for (const step of Array.from({length: 20}).keys()) {
	const color = rainbowColors[frame % rainbowColors.length];
	const sparkle = sparkles[frame % sparkles.length];

	logUpdate(
		chalk[color](`  ${sparkle} Making rainbow magic ${'.'.repeat((frame % 3) + 1)}\n`)
		+ chalk.gray(`     ${'█'.repeat(step + 1)}${'░'.repeat(20 - step)}\n`)
		+ chalk.yellow(`     ${unicorns[frame % 3]} Unicorn power: ${((step + 1) * 5)}%`),
	);

	frame++;
	// eslint-disable-next-line no-await-in-loop
	await delay(150);
}

// Persist a celebration
logUpdate.persist(chalk.green('\n  🎉 Rainbow magic complete!\n'));

// Phase 2: Mixing updates with persisted unicorn messages
console.log(chalk.cyan('🦄 Phase 2: Collecting unicorns!\n'));

const unicornNames = ['Sparkle', 'Rainbow', 'Stardust', 'Moonbeam', 'Glitter'];

for (const [index, name] of unicornNames.entries()) {
	// Update the search animation
	for (const animationFrame of Array.from({length: 8}).keys()) {
		const dots = '.'.repeat((animationFrame % 4));
		const spaces = ' '.repeat(3 - (animationFrame % 4));
		logUpdate(
			chalk.magenta(`  🔮 Searching for ${name}${dots}${spaces}`),
		);
		// eslint-disable-next-line no-await-in-loop
		await delay(100);
	}

	// Persist the found unicorn!
	const color = rainbowColors[index % rainbowColors.length];
	logUpdate.persist(
		chalk[color](`  🦄 Found ${name}!`)
		+ ' '
		+ chalk.dim('✨'.repeat(3)),
	);

	// eslint-disable-next-line no-await-in-loop
	await delay(200);
}

// Final celebration
logUpdate.clear();

const finalMessage = `
${chalk.magenta('  🌈✨🦄✨🌈')}

${chalk.cyan('  All unicorns found!')}
${chalk.yellow('  Your rainbow is complete!')}

${chalk.gray('  The magic of log.persist():')}
${chalk.gray('  • Regular log() updates in place')}
${chalk.gray('  • log.persist() keeps messages in scrollback')}
${chalk.gray('  • Perfect for progress + permanent logs!')}

${chalk.magenta('  ✨ Thanks for watching! ✨')}
`;

logUpdate.persist(finalMessage);

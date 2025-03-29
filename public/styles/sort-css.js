import { readFile, writeFile } from "fs/promises";

try {
	const css = await readFile("styles.css", "utf8");

	// Match CSS blocks: selector { ... }
	const blocks = css.match(/[^}]+{[^}]*}/g);

	if (blocks) {
		const sorted = blocks.sort((a, b) =>
			a.trim().localeCompare(b.trim(), undefined, { sensitivity: "base" })
		);
		await writeFile("style.sorted.css", sorted.join("\n\n"));
		console.log("✅ Sorted CSS saved to style.sorted.css");
	} else {
		console.log("⚠️ No CSS blocks found.");
	}
} catch (err) {
	console.error("❌ Error:", err);
}

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const destination = resolve("dist/round3_investigation");

await mkdir(destination, { recursive: true });
await writeFile(
  resolve(destination, "index.html"),
  `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta http-equiv="refresh" content="0;url=../dashboard/round3">
		<title>Case HELIX</title>
	</head>
	<body>
		<p><a href="../dashboard/round3">Open Case HELIX</a></p>
		<script>window.location.replace('../dashboard/round3');</script>
	</body>
</html>
`,
);

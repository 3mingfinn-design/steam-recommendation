import { execFileSync } from "node:child_process";

const customMessage = process.argv.slice(2).join(" ").trim();
const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
const message = customMessage || `backup: ${timestamp}`;

execFileSync("git", ["add", "-A"], { stdio: "inherit" });

try {
  execFileSync("git", ["diff", "--cached", "--quiet"], { stdio: "ignore" });
  console.log("没有新的文件修改，不需要创建备份。");
} catch {
  execFileSync("git", ["commit", "-m", message], { stdio: "inherit" });
}

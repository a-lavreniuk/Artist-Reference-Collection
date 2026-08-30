/** JoyCaption лежит на диске один раз: автотеги и Qwen Medium/Heavy делят одни файлы. */

export function shouldKeepSharedCaptionFiles(
  qwenStillInstalled: boolean,
  autoTagProductInstalled: boolean
): boolean {
  return qwenStillInstalled || autoTagProductInstalled;
}

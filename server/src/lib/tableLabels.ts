export function tablePrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let prefix: string;
  if (words.length >= 2) {
    prefix = words[0][0] + words[words.length - 1];
  } else {
    prefix = name;
  }
  prefix = prefix.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
  return prefix || "TBL";
}

export function seatLabel(name: string, seatNumber: number): string {
  return `${tablePrefix(name)}-${seatNumber}`;
}

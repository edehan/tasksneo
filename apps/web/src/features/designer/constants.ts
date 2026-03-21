export const CLASS_COLOR_PALETTE = [
  "#5B8C6A",
  "#7B6CB0",
  "#C4785B",
  "#5886A5",
  "#8B7355",
  "#B07090",
  "#6B8FA3",
  "#A0855B",
];

export function roleCanManageClass(role: "OWNER" | "ADMIN" | "MEMBER") {
  return role === "OWNER" || role === "ADMIN";
}

export function roleLabel(role: "OWNER" | "ADMIN" | "MEMBER") {
  if (role === "OWNER") return "所有者";
  if (role === "ADMIN") return "管理员";
  return "成员";
}

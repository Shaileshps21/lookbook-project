export const formatPrice = (value: number) =>
  `\u20b9${value.toLocaleString("en-IN")}`;

export const formatCompactNumber = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${value}`;
};

export const truncate = (text: string, length = 120) =>
  text.length > length ? `${text.slice(0, length).trim()}...` : text;

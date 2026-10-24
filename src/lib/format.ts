// Locale-free date formatting so server and browser render identical text.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
};

export const monthShort = (m: number) => MON[m];
export const dShort = (iso: string) => { const { m, d } = parts(iso); return `${String(d).padStart(2, "0")} ${MON[m]}`; };
export const dMedium = (iso: string) => { const { y, m, d } = parts(iso); return `${d} ${MON[m]} ${y}`; };
export const dLong = (iso: string) => { const { y, m, d } = parts(iso); return `${d} ${MONTH[m]} ${y}`; };

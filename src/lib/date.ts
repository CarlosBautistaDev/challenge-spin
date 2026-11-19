const timeZone = 'America/Mexico_City';

const dateFormatters = {
  movement: new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone }),
  receipt: new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone,
  }),
};

export function formatWalletDate(value: string, style: keyof typeof dateFormatters) {
  return dateFormatters[style].format(new Date(value));
}

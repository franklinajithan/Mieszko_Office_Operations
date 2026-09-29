export function isSixDigitPin(pin: string) {
  return /^\d{6}$/.test(pin);
}

export function pinCooldownActive(recentFailures: number, secondsSinceLatest: number) {
  return recentFailures >= 8 && secondsSinceLatest < 60;
}

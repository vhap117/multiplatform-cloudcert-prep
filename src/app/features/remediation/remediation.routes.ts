/** Path of the remediation session for a cert. */
export function remediationPath(certCode: string): string {
  return `/remediation/${certCode}`;
}

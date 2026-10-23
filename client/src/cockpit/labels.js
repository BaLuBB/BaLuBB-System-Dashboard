/** Lesbare Namen für die technischen Aktionsschlüssel des Dashboard-Protokolls. Unbekannte Schlüssel werden zu Text ohne Unterstriche, bereits lesbare Namen bleiben unverändert. */
const ACTION_LABELS = {
  role_page_access_update: 'Seitenzugriff für Rollen geändert',
  guild_config: 'Server-Einstellungen geändert',
  custom_bot_assign: 'Eigenen Bot zugewiesen',
  statuspage_visibility: 'Sichtbarkeit der Statusseite geändert',
  infra_layout: 'Anordnung der Server-Übersicht geändert',
  feedback_status: 'Feedback-Status geändert',
  feedback_submit: 'Feedback abgeschickt',
  ticket_update: 'Ticket bearbeitet',
};

export function actionLabel(key) {
  if (key == null || key === '') return '–';
  const k = String(key);
  if (ACTION_LABELS[k]) return ACTION_LABELS[k];
  if (!/^[a-z0-9]+(_[a-z0-9]+)+$/.test(k)) return k;
  const t = k.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Name für einen Server, den die API ohne Namen liefert: mit den letzten Ziffern der Kennung, damit er sich wiedererkennen lässt. */
export function serverName(s) {
  if (s?.name != null && String(s.name).trim() !== '') return s.name;
  const id = s?.id != null ? String(s.id) : '';
  return id ? `Unbenannter Server (Kennung …${id.slice(-4)})` : 'Unbenannter Server';
}

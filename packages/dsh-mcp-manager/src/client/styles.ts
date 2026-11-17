/** Native 14/22 body type and 16/24 titles; compact rows share the client's control scale. */
export const styles = `
.shinku-mcp { color:var(--dsw-alias-label-primary); font:inherit; font-size:14px; line-height:22px; min-width:0; }
.shinku-mcp-title { display:flex; align-items:center; gap:8px; margin:0 0 16px; font-size:16px; line-height:24px; font-weight:500; }
.shinku-mcp-description { color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; margin:8px 0; overflow-wrap:anywhere; }
.shinku-mcp-meta { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.shinku-mcp-field-label { display:grid; gap:6px; margin:12px 0 6px; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
.shinku-mcp-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0; }
.shinku-mcp-settings-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:4px; }
.shinku-mcp-settings-header .shinku-mcp-title { margin:0; min-height:28px; }
.shinku-mcp-profile-picker { display:flex; width:100%; min-width:0; }
.shinku-mcp-profile-picker > .shinku-mcp-profile-trigger { width:100%; height:32px; justify-content:space-between; padding:0 8px; border:0.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); box-shadow:none; font-size:14px; line-height:22px; }
.shinku-mcp-profile-picker > .shinku-mcp-profile-trigger[aria-expanded="true"] { border-color:var(--dsw-alias-state-business-primary); }
.shinku-mcp-profile-trigger { min-width:0; max-width:100%; }
.shinku-mcp-profile-trigger > span { min-width:0; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.shinku-mcp-profile-trigger > svg { flex:none; }
/* Native outline buttons reserve a transparent border before their inset stroke.
   Remove that extra inset so their visible edge aligns with the input and row edges. */
.shinku-mcp-secondary { border:0; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); box-shadow:inset 0 0 0 var(--dsh-hairline-width,0.5px) var(--dsh-button-outline-color,var(--dsw-alias-border-l4)); }
.shinku-mcp-danger { --dsh-button-outline-color:var(--dsw-alias-state-error-primary); color:var(--dsw-alias-state-error-primary); background:transparent; }
.shinku-mcp-delete-dialog h2 > svg { color:var(--dsw-alias-state-error-primary); }
@media(hover:hover) {
  .shinku-mcp-secondary:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
  .shinku-mcp-danger:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); }
}
.shinku-mcp-danger:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); }
.shinku-mcp-danger:focus-visible { outline:2px solid var(--dsw-alias-state-error-primary); outline-offset:2px; }
.shinku-mcp-setting-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(160px,240px); align-items:center; gap:16px; padding:16px 0; border-bottom:0.5px solid var(--dsw-alias-border-l2); }
.shinku-mcp-setting-row > label:only-child { grid-column:1 / -1; }
.shinku-mcp-section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:24px 0 12px; }
.shinku-mcp-section-heading h3 { margin:0; font-size:14px; line-height:22px; font-weight:500; }
.shinku-mcp-settings-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; padding-top:16px; margin-top:16px; border-top:0.5px solid var(--dsw-alias-border-l2); }
.shinku-mcp-tree { display:flex; flex-direction:column; min-width:0; }
.shinku-mcp-tree > :first-child { margin-bottom:8px; }
.shinku-mcp-server { border-bottom:0.5px solid var(--dsw-alias-border-l2); min-width:0; }
.shinku-mcp-server:last-child { border-bottom:0; }
.shinku-mcp-server-heading { display:grid; grid-template-columns:minmax(0,1fr) auto 28px; align-items:center; gap:12px; min-height:48px; padding:4px 0; box-sizing:border-box; }
.shinku-mcp-server-missing { grid-template-columns:minmax(0,1fr) auto; }
.shinku-mcp-server-name { min-width:0; overflow-wrap:anywhere; }
.shinku-mcp-server-name > span { min-width:0; }
.shinku-mcp-server-info { display:flex; align-items:center; justify-content:flex-end; gap:12px; }
.shinku-mcp-server-info > .shinku-mcp-meta { white-space:nowrap; }
.shinku-mcp-server-toggle { width:28px; padding:0; flex:none; color:var(--dsw-alias-label-secondary); }
.shinku-mcp-server-details { margin:0 0 12px 8px; padding:4px 0 0 12px; border-left:0.5px solid var(--dsw-alias-border-l2); min-width:0; }
.shinku-mcp-server-details > .shinku-mcp-meta { margin:0 0 4px; }
.shinku-mcp-disclosure { justify-content:flex-start; max-width:100%; text-align:left; overflow-wrap:anywhere; height:auto; min-height:28px; padding:4px 0; font-size:13px; line-height:20px; }
.shinku-mcp-children { margin:4px 0 8px 20px; min-width:0; }
.shinku-mcp-tool { min-width:0; }
.shinku-mcp-schema { max-height:220px; overflow:auto; padding:12px; margin:6px 0; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); border-radius:var(--dsw-radius-md); white-space:pre; font:12px/20px var(--ds-font-family-code); }
.shinku-mcp-dialog { width:min(480px,100%); max-height:100%; padding:0; gap:0; }
.shinku-mcp-dialog-header { display:flex; flex:none; align-items:center; justify-content:space-between; gap:12px; padding:20px 16px 12px 24px; }
.shinku-mcp-dialog-header h2 { margin:0; color:var(--dsw-alias-label-primary); font-size:16px; line-height:24px; font-weight:500; }
.shinku-mcp-dialog-close { flex:none; width:28px; padding:0; color:var(--dsw-alias-label-secondary); }
.shinku-mcp-dialog-content { min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:0 24px 20px; }
.shinku-mcp-dialog-footer { display:flex; flex:none; align-items:center; justify-content:flex-end; gap:8px; padding:12px 24px 20px; border-top:0.5px solid var(--dsw-alias-border-l2); }
.shinku-mcp-session { display:flex; flex-direction:column; gap:16px; }
.shinku-mcp-empty { margin:0; padding:4px 0; color:var(--dsw-alias-label-secondary); }
.shinku-mcp-error { display:flex; align-items:center; gap:8px; color:var(--dsw-alias-label-error); font-size:13px; line-height:20px; overflow-wrap:anywhere; }
.shinku-mcp-indicator { gap:6px; max-width:min(340px,60vw); min-width:0; }
.shinku-mcp-indicator-name { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:140px; }
.shinku-mcp-tag { flex:none; padding:0 4px; border-radius:var(--dsw-radius-xs); background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-secondary); font-size:11px; line-height:16px; font-weight:400; }
.shinku-mcp-status { display:inline-flex; align-items:center; gap:5px; flex:none; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; white-space:nowrap; }
.shinku-mcp-status::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--dsw-alias-label-tertiary); }
.shinku-mcp-status[data-state="ready"]::before { background:var(--dsw-alias-state-success-primary); }
.shinku-mcp-status[data-state="runtimeError"]::before { background:var(--dsw-alias-state-error-primary); }
.shinku-mcp-profile-item { display:flex; flex-direction:column; gap:2px; min-width:0; }
.shinku-mcp-summary { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.shinku-mcp-summary-content { display:flex; flex-direction:column; gap:4px; min-width:0; }
.shinku-mcp-summary-details { display:flex; align-items:center; flex-wrap:wrap; gap:4px 12px; }
.shinku-mcp-summary-name { display:flex; align-items:center; gap:8px; overflow-wrap:anywhere; }
.shinku-mcp-summary-name svg { flex:none; }
.shinku-mcp-summary-name strong { font-size:14px; line-height:22px; font-weight:500; }
.shinku-mcp-health { display:flex; flex-wrap:wrap; gap:12px; color:var(--dsw-alias-label-secondary); font-size:12px; line-height:18px; }
@media(max-width:480px) {
  .shinku-mcp-setting-row { grid-template-columns:minmax(0,1fr); gap:8px; }
  .shinku-mcp-server-heading { gap:8px; }
  .shinku-mcp-server-info { flex-direction:column; align-items:flex-end; gap:0; }
  .shinku-mcp-indicator { max-width:60vw; }
  .shinku-mcp-indicator-name { max-width:90px; }
  .shinku-mcp-summary { flex-wrap:wrap; }
}
`;

/** Feature layout uses DSH design tokens; shared primitives own control and overlay styling. */
export const styles = `
.shinku-mcp { color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; line-height:1.5; min-width:0; }
.shinku-mcp-title { display:flex; align-items:center; gap:8px; margin:0 0 8px; font-size:16px; font-weight:600; }
.shinku-mcp-description { color:var(--dsw-alias-label-secondary); font-size:12px; line-height:1.5; margin:6px 0 14px; overflow-wrap:anywhere; }
.shinku-mcp-meta { color:var(--dsw-alias-label-tertiary); font-size:11px; overflow-wrap:anywhere; }
.shinku-mcp-field-label { display:grid; gap:6px; margin:14px 0; color:var(--dsw-alias-label-secondary); font-size:12px; }
.shinku-mcp-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:14px 0; }
.shinku-mcp-tree { display:grid; gap:8px; margin:14px 0; }
.shinku-mcp-server { border-bottom:0.5px solid var(--dsw-alias-border-l1); padding:10px 0; min-width:0; }
.shinku-mcp-server-heading { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; }
.shinku-mcp-disclosure { justify-content:flex-start; max-width:100%; text-align:left; overflow-wrap:anywhere; height:auto; }
.shinku-mcp-children { margin:6px 0 4px 20px; min-width:0; }
.shinku-mcp-tool { margin:6px 0; }
.shinku-mcp-schema { max-height:260px; overflow:auto; padding:12px; margin:6px 0; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-secondary); border-radius:var(--dsw-radius-md); white-space:pre; font-size:12px; }
.shinku-mcp-dialog { width:min(560px,100%); max-height:100%; }
.shinku-mcp-dialog-content { min-height:0; overflow-y:auto; }
.shinku-mcp-dialog-content > p { color:var(--dsw-alias-label-secondary); font-size:12px; line-height:1.5; }
.shinku-mcp-error { display:flex; align-items:center; gap:8px; color:var(--dsw-alias-label-error); font-size:12px; overflow-wrap:anywhere; }
.shinku-mcp-indicator { gap:6px; max-width:min(340px,60vw); min-width:0; }
.shinku-mcp-indicator-name { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:140px; }
.shinku-mcp-tag { flex:none; padding:1px 5px; border-radius:var(--dsw-radius-sm); background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-secondary); font-size:10px; font-weight:400; }
.shinku-mcp-status { display:inline-flex; align-items:center; gap:5px; flex:none; color:var(--dsw-alias-label-secondary); font-size:11px; white-space:nowrap; }
.shinku-mcp-status::before { content:""; width:5px; height:5px; border-radius:50%; background:var(--dsw-alias-label-tertiary); }
.shinku-mcp-status[data-state="ready"]::before { background:var(--dsw-alias-state-success-primary); }
.shinku-mcp-status[data-state="runtimeError"]::before { background:var(--dsw-alias-state-error-primary); }
.shinku-mcp-profile-item { display:flex; flex-direction:column; gap:2px; min-width:0; }
.shinku-mcp-summary { display:flex; flex-direction:column; gap:5px; padding:12px 0; border-bottom:0.5px solid var(--dsw-alias-border-l1); }
.shinku-mcp-summary-name { display:flex; align-items:center; gap:8px; overflow-wrap:anywhere; }
.shinku-mcp-summary-name strong { font-size:14px; font-weight:500; }
.shinku-mcp-health { display:flex; flex-wrap:wrap; gap:12px; margin-top:4px; color:var(--dsw-alias-label-secondary); font-size:12px; }
@media(max-width:540px) { .shinku-mcp-indicator { max-width:60vw; } .shinku-mcp-indicator-name { max-width:90px; } .shinku-mcp-server-heading { flex-wrap:wrap; } }
`;

import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, relTime, emptyState, confirmDialog } from '../ui.js';
import { notifications } from '../store.js';

await guard();
await mountApp({ title: 'Notifications' });

async function render() {
  const list = await notifications.list();
  const unread = list.filter((n) => !n.read).length;

  pageRoot().innerHTML = `
    <div class="page-head">
      <div><h1>Notifications</h1><p class="muted small mt-4">${unread ? `${unread} unread` : 'You are all caught up.'}</p></div>
      <div class="row gap-10">
        ${unread ? '<button class="btn btn-ghost" id="markAll">Mark all read</button>' : ''}
        ${list.length ? '<button class="btn btn-ghost" id="clearAll">Clear all</button>' : ''}
      </div>
    </div>

    ${list.length ? `<div class="col gap-10" id="list">
      ${list.map((n) => `
        <button class="notif ${n.read ? '' : 'unread'}" data-read="${n.id}">
          <div class="icon-box plain" style="width:36px;height:36px;flex:none">${n.icon || '🔔'}</div>
          <div class="grow" style="text-align:left;min-width:0">
            <b class="small">${esc(n.title)}</b>
            <span class="tiny dim" style="display:block">${esc(n.body || '')}</span>
          </div>
          <span class="tiny dim nowrap">${relTime(n.createdAt)}</span>
        </button>`).join('')}
    </div>` : emptyState('Nothing here', 'Streak reminders and score updates will show up in this list.')}`;

  $$('[data-read]').forEach((b) => b.addEventListener('click', async () => {
    await notifications.markRead(b.dataset.read);
    render();
  }));
  $('#markAll')?.addEventListener('click', async () => { await notifications.markAllRead(); render(); });
  $('#clearAll')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Clear all notifications?', 'This cannot be undone.', { danger: true }))) return;
    await notifications.clear();
    render();
  });
}

loadPage(render, 'your notifications');

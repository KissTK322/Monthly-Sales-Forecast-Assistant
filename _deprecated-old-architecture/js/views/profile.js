/* views/profile.js — the screen where a person says who they are.
 *
 * The plain warning about the data not being encrypted lives here, in both
 * languages, because this is the screen that would otherwise imply security.
 */
(function (MSFA) {
  'use strict';

  MSFA.views = MSFA.views || {};

  function warningBlock() {
    var ui = MSFA.ui, t = MSFA.i18n.t;
    var box = ui.el('div', 'notice notice--warn');
    box.appendChild(ui.el('strong', null, t('profile.notEncryptedTitle')));
    box.appendChild(ui.el('p', null, t('profile.notEncryptedBody')));
    return box;
  }

  function createDialog(state, onDone) {
    var ui = MSFA.ui, t = MSFA.i18n.t;
    var P = MSFA.profiles;

    var name = ui.input({});
    var passcode = ui.input({ type: 'password' });
    var role = ui.select(P.ROLES.map(function (value) { return { value: value, label: t('role.' + value) }; }),
      { value: 'sales' });
    var code = ui.input({ placeholder: '04' });
    var problem = ui.el('p', 'notice notice--warn', '');

    var first = !state.hasProfiles;
    var content = [
      ui.el('p', 'empty__body', first ? t('profile.createFirst') : ''),
      ui.field(t('profile.displayName'), name),
      ui.field(t('profile.passcode'), passcode, t('profile.passcodeRule')),
      ui.el('p', 'chart-note', t('profile.passcodeWhy')),
      ui.el('p', 'chart-note', t('profile.noRecovery'))
    ];
    if (!first) {
      content.push(ui.field(t('profile.role'), role));
      content.push(ui.field(t('profile.salespersonCode'), code));
    }
    content.push(problem);

    MSFA.ui.dialog({
      title: t('profile.create'),
      content: content,
      actions: [
        { label: t('toast.dismiss'), variant: 'secondary' },
        {
          label: t('profile.create'),
          close: false,
          onClick: function (node) {
            var check = P.checkPasscode(passcode.value);
            if (!check.ok) { problem.textContent = t('profile.reject.' + check.reason); return; }

            P.createProfile(MSFA.storage.profileStore, {
              displayName: name.value,
              role: first ? 'management' : role.value,
              salespersonCode: code.value || null,
              passcode: passcode.value,
              now: Date.now()
            }).then(function () {
              passcode.value = '';
              state.hasProfiles = true;
              node.close();
              if (onDone) onDone();
            }).catch(function (error) {
              problem.textContent = String(error && error.message ? error.message : error);
            });
          }
        }
      ]
    });
  }

  MSFA.views.profile = {
    openCreateDialog: createDialog,

    render: function (root, ctx) {
      var ui = MSFA.ui, t = MSFA.i18n.t;
      var P = MSFA.profiles;

      var card = ui.card([ui.sectionHeader(t('profile.title'))]);
      card.appendChild(warningBlock());

      P.pendingResetNotice(MSFA.storage.profileStore).then(function (notice) {
        if (!notice) return;
        var box = ui.el('div', 'notice notice--warn');
        box.appendChild(ui.el('span', null,
          t('profile.resetNotice') + ' ' + ui.formatDate(new Date(notice.at).toISOString().slice(0, 10))));
        box.appendChild(ui.button(t('profile.resetAcknowledge'), {
          variant: 'quiet',
          onClick: function () { P.acknowledgeReset(MSFA.storage.profileStore).then(function () { box.remove(); }); }
        }));
        card.appendChild(box);
      });

      MSFA.storage.profileStore.list().then(function (profiles) {
        var list = profiles || [];
        if (!list.length) {
          card.appendChild(ui.button(t('profile.createFirst'), {
            onClick: function () { createDialog(ctx.state, ctx.refresh); }
          }));
          return;
        }

        var picker = ui.select(list.map(function (profile) {
          return { value: profile.id, label: profile.displayName + ' · ' + t('role.' + profile.role) };
        }), {});
        var passcode = ui.input({ type: 'password' });
        var problem = ui.el('p', 'notice notice--warn', '');

        card.appendChild(ui.field(t('profile.select'), picker));
        card.appendChild(ui.field(t('profile.passcode'), passcode));
        card.appendChild(problem);

        card.appendChild(ui.button(t('profile.unlock'), {
          onClick: function () {
            problem.textContent = '';
            P.verifyPasscode(MSFA.storage.profileStore, picker.value, passcode.value, Date.now())
              .then(function (result) {
                if (result.ok) {
                  passcode.value = '';
                  ctx.onUnlocked(result.profile);
                  return;
                }
                problem.textContent = result.reason === 'wait' ? t('profile.wait') : t('profile.wrong');
              })
              .catch(function () { problem.textContent = t('profile.wrong'); });
          }
        }));

        card.appendChild(ui.el('p', 'chart-note', t('profile.noRecovery')));

        card.appendChild(ui.button(t('profile.reset'), {
          variant: 'quiet',
          onClick: function () {
            MSFA.ui.dialog({
              title: t('profile.reset'),
              content: [ui.el('p', null, t('profile.resetExplain'))],
              actions: [
                { label: t('toast.dismiss'), variant: 'secondary' },
                {
                  label: t('profile.reset'), variant: 'destructive',
                  onClick: function () {
                    P.resetAllProfiles(MSFA.storage.profileStore, Date.now()).then(function () {
                      ctx.state.hasProfiles = false;
                      ctx.refresh();
                    });
                  }
                }
              ]
            });
          }
        }));
      });

      root.appendChild(card);
    }
  };
})(window.MSFA = window.MSFA || {});

import { AppShell } from "@/components/app-shell";
import {
  AccountLoginForm,
  ChecklistItemEditForm,
  ChecklistTemplateEditForm,
  ChecklistTemplateForm,
  CompanySettingsForm,
  DocumentTemplateForm,
  RolePermissionForm,
  UserForm,
} from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { Card, Button, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { permissions } from "@/lib/constants";
import {
  listChecklistItems,
  listChecklistTemplates,
  listCompanySettings,
  listDocumentTemplates,
  listRoles,
  listServices,
  listUsers,
} from "@/lib/data";
import { syncMyGoogleCalendar } from "@/lib/actions";
export const dynamic = "force-dynamic";
export default async function SettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const currentUser = await requirePagePermission(permissions.settingsManage);
  const params = (await searchParams) ?? {};
  const googleSync = typeof params.googleSync === "string" ? params.googleSync : null;
  const googleSyncMessage = typeof params.message === "string" ? params.message : null;
  const syncCounts = {
    attempted: typeof params.attempted === "string" ? params.attempted : "0",
    synced: typeof params.synced === "string" ? params.synced : "0",
    skipped: typeof params.skipped === "string" ? params.skipped : "0",
    failed: typeof params.failed === "string" ? params.failed : "0",
  };
  const [
    users,
    roles,
    services,
    templates,
    items,
    companySettings,
    documentTemplates,
  ] = await Promise.all([
    listUsers(),
    listRoles(),
    listServices(),
    listChecklistTemplates(),
    listChecklistItems(),
    listCompanySettings(),
    listDocumentTemplates(),
  ]);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Review system settings, employee access, Google account linking, documents and reusable SOP checklists. Manage the Services catalogue from its dedicated page."
        actions={
          <>
            <ModalPanel
              title="Update my login details"
              triggerLabel="Login details"
            >
              {currentUser ? (
                <AccountLoginForm user={currentUser} />
              ) : (
                <p className="text-sm text-slate-400">
                  No active user session.
                </p>
              )}
            </ModalPanel>
            <LinkButton href="/api/auth/google/start?mode=connect&returnTo=/settings" variant="ghost">Connect Google</LinkButton>
            <form action={syncMyGoogleCalendar}>
              <input type="hidden" name="returnTo" value="/settings" />
              <Button type="submit">Sync Google Calendar</Button>
            </form>
            <ModalPanel
              title="Add employee"
              triggerLabel="Add employee"
              variant="ghost"
            >
              <UserForm roles={roles} />
            </ModalPanel>
            <ModalPanel
              title="Billing & document settings"
              triggerLabel="Billing settings"
              variant="ghost"
            >
              <CompanySettingsForm settings={companySettings} />
            </ModalPanel>
          </>
        }
      />
      {googleSync ? (
        <Card className={googleSync === "success" ? "border-emerald-400/30 bg-emerald-400/10" : "border-red-400/30 bg-red-400/10"}>
          <p className="text-sm font-semibold text-white">
            {googleSync === "success" ? "Google Calendar sync completed." : "Google Calendar sync had errors."}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Attempted {syncCounts.attempted}, synced {syncCounts.synced}, skipped {syncCounts.skipped}, failed {syncCounts.failed}.
            {googleSyncMessage ? ` ${googleSyncMessage}` : ""}
          </p>
        </Card>
      ) : null}
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Users", users.length],
            ["Services catalogue", services.length],
            ["Checklist templates", templates.length],
            ["Document templates", documentTemplates.length],
          ].map(([label, value]) => (
            <Card key={label}>
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            </Card>
          ))}
        </div>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Document templates
            </h2>
            <ModalPanel
              title="Create document template"
              triggerLabel="Add template"
              variant="ghost"
            >
              <DocumentTemplateForm />
            </ModalPanel>
          </div>
          <div className="grid gap-2">
            {documentTemplates.map((template) => (
              <ModalPanel key={template.id} title={`Edit ${template.name}`} triggerLabel={template.name} variant="ghost">
                <div className="mb-4 rounded-xl bg-white/[0.04] p-3 text-sm text-slate-300">
                  <p className="font-semibold text-white">{template.name}</p>
                  <p>{template.type}{template.is_default ? " • Default" : ""}</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-300">{template.content}</pre>
                </div>
                <DocumentTemplateForm template={template} />
              </ModalPanel>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Checklist templates
            </h2>
            <ModalPanel
              title="Checklist templates"
              triggerLabel="Manage checklists"
              variant="ghost"
            >
              <ChecklistTemplateForm
                services={services}
                templates={templates}
              />
              <div className="mt-4 grid gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-2xl bg-white/[0.04] p-4"
                  >
                    <ChecklistTemplateEditForm
                      template={template}
                      services={services}
                    />
                    <div className="mt-3 grid gap-2">
                      {items
                        .filter((item) => item.template_id === template.id)
                        .map((item) => (
                          <ChecklistItemEditForm
                            key={item.id}
                            item={item}
                            templates={templates}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </ModalPanel>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl bg-white/[0.04] p-3">
                <p className="font-semibold text-white">{template.name}</p>
                <p className="text-xs text-slate-400">
                  {
                    items.filter((item) => item.template_id === template.id)
                      .length
                  }{" "}
                  items
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Users and access
          </h2>
          <div className="grid gap-3">
            {users.map((user) => (
              <ModalPanel key={user.id} title={`Edit ${user.name}`} triggerLabel={user.name} variant="ghost">
                <div className="mb-4 flex items-center justify-between rounded-xl bg-white/[0.04] p-3">
                  <div>
                    <p className="font-semibold text-white">{user.name}</p>
                    <p className="text-sm text-slate-400">
                      {user.email} • {user.role?.name ?? "No role"} • {user.department ?? "No department"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{user.specialties ?? "No specialties"}</p>
                  </div>
                  <StatusBadge value={user.status} />
                </div>
                <UserForm roles={roles} user={user} />
              </ModalPanel>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Role permission matrix
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => (
              <ModalPanel key={role.id} title={`Edit ${role.name} permissions`} triggerLabel={role.name} variant="ghost">
                <p className="mb-4 text-sm text-slate-400">{role.permissions.length} permissions assigned to this role.</p>
                <RolePermissionForm role={role} />
              </ModalPanel>
            ))}
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Services catalogue
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Service pricing, descriptions and active status are managed from
                the dedicated Services catalogue page so quote defaults stay in
                one canonical place.
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {services.length} services configured
              </p>
            </div>
            <LinkButton href="/services">Open Services catalogue</LinkButton>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

import { AppShell } from "@/components/app-shell";
import {
  AccountLoginForm,
  ChecklistItemEditForm,
  ChecklistTemplateEditForm,
  ChecklistTemplateForm,
  CompanySettingsForm,
  DocumentTemplateForm,
  UserForm,
} from "@/components/forms";
import { ModalPanel } from "@/components/modal-panel";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { requirePagePermission } from "@/lib/auth";
import { permissions, rolePermissionMap } from "@/lib/constants";
import {
  listChecklistItems,
  listChecklistTemplates,
  listCompanySettings,
  listDocumentTemplates,
  listRoles,
  listServices,
  listUsers,
} from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const currentUser = await requirePagePermission(permissions.settingsManage);
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
        description="Review system settings and open focused pop-ups to edit employees, login details, documents and reusable SOP checklists."
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
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Users", users.length],
            ["Services", services.length],
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
              <div key={template.id} className="rounded-xl bg-white/[0.04] p-3">
                <p className="font-semibold text-white">{template.name}</p>
                <p className="text-xs text-slate-400">
                  {template.type}
                  {template.is_default ? " • Default" : ""}
                </p>
              </div>
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
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3"
              >
                <div>
                  <p className="font-semibold text-white">{user.name}</p>
                  <p className="text-sm text-slate-400">
                    {user.email} • {user.role?.name ?? "No role"}
                  </p>
                </div>
                <StatusBadge value={user.status} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Role permission matrix
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(rolePermissionMap).map(([role, perms]) => (
              <div key={role} className="rounded-xl border border-white/10 p-3">
                <p className="font-semibold text-white">{role}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {perms.length} permissions
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Services catalogue
          </h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <div key={service.id} className="rounded-xl bg-white/[0.04] p-3">
                <p className="font-semibold text-white">{service.name}</p>
                <p className="text-xs text-slate-400">{service.category}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

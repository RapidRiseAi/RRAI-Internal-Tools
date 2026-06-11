import { AppShell } from "@/components/app-shell";
import { ClientForm } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
export default function NewClient() { return <AppShell><PageHeader title="Create client" eyebrow="Accounts" description="Create a Supabase-backed client profile before adding projects, retainers and support tickets." /><Card><ClientForm /></Card></AppShell>; }

alter table public.files
  add column if not exists lead_id uuid references public.leads(id),
  add column if not exists knowledge_base_item_id uuid references public.knowledge_base_items(id);

update public.files files
set lead_id = files.entity_id
where files.entity_type = 'Lead'
  and files.lead_id is null
  and exists (select 1 from public.leads leads where leads.id = files.entity_id);

update public.files files
set knowledge_base_item_id = files.entity_id
where files.entity_type = 'KnowledgeBase'
  and files.knowledge_base_item_id is null
  and exists (select 1 from public.knowledge_base_items items where items.id = files.entity_id);

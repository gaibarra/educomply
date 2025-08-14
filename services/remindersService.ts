import { supabase } from './supabaseClient';

export interface CreateReminderInput {
  taskId: string;
  remindAt?: string | null; // ISO timestamp
  meta?: any;
}

export async function createReminder({ taskId, remindAt = null, meta }: CreateReminderInput) {
  const { data, error } = await supabase.from('reminders').insert({ task_id: taskId, remind_at: remindAt, meta }).select('id, remind_at');
  if (error) throw error;
  return data?.[0];
}

export async function listReminders(taskId?: string) {
  const query = supabase.from('reminders').select('*').order('created_at', { ascending: false }).limit(100);
  if (taskId) query.eq('task_id', taskId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteReminder(id: string) {
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}

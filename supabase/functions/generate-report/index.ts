// @ts-nocheck Deno read-only file system workaround
declare const Deno: any;

import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from 'npm:@supabase/supabase-js';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';
import { buildCorsHeadersForRequest } from "../_shared/cors.ts";

// Function to get Supabase client
const getSupabaseClient = (req) => {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: auth } } }
    );
};

const getTaskStatus = (task) => {
    const dueDateStr = task.scope?.due_date;
    if (!task.sub_tasks || task.sub_tasks.length === 0) {
        if (!dueDateStr) return 'Pendiente';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(dueDateStr + 'T00:00:00');
        return dueDate < today ? 'Atrasada' : 'Pendiente';
    }
    const completedSubTasks = task.sub_tasks.filter(st => st.status === 'Completada').length;
    if (task.sub_tasks.length > 0 && completedSubTasks === task.sub_tasks.length) return 'Completada';
    if (dueDateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(dueDateStr + 'T00:00:00');
        if (dueDate < today) return 'Atrasada';
    }
    if (completedSubTasks > 0) return 'En Progreso';
    return 'Pendiente';
};

// --- PREDEFINED REPORT HANDLERS ---

const handleGeneralStatusReport = async (supabase) => {
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*, sub_tasks(*)');
    if (tasksError) throw tasksError;

    const totalTasks = tasks.length;
    const tasksWithStatus = tasks.map(t => ({...t, overallStatus: getTaskStatus(t)}));
    const completedTasks = tasksWithStatus.filter(t => t.overallStatus === 'Completada').length;
    const overdueTasks = tasksWithStatus.filter(t => t.overallStatus === 'Atrasada').length;
    const complianceRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) : 100;

    let content = `
# Reporte General de Cumplimiento
Fecha de Generación: ${new Date().toLocaleDateString('es-MX')}

## Resumen Ejecutivo
- **Tasa de Cumplimiento General:** ${complianceRate}%
- **Total de Tareas:** ${totalTasks}
- **Tareas Completadas:** ${completedTasks}
- **Tareas Pendientes o en Progreso:** ${totalTasks - completedTasks - overdueTasks}
- **Tareas Atrasadas:** ${overdueTasks}

---

## Análisis
El estado general de cumplimiento de la institución se encuentra en un **${complianceRate}%**. 
Existen **${overdueTasks}** tareas que requieren atención inmediata para mitigar riesgos.
    `;
    return { title: 'Reporte General de Cumplimiento', content };
};

const handleTasksByAreaReport = async (supabase) => {
    const { data: areas, error: areasError } = await supabase.from('responsible_areas').select('id, name');
    if (areasError) throw areasError;
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*, sub_tasks(*)');
    if (tasksError) throw tasksError;

    const tasksByArea = {};
    areas.forEach(area => {
        tasksByArea[area.id] = { name: area.name, Pendiente: 0, 'En Progreso': 0, Completada: 0, Atrasada: 0, Total: 0 };
    });

    tasks.forEach(task => {
        if (task.responsible_area_id && tasksByArea[task.responsible_area_id]) {
            const status = getTaskStatus(task);
            tasksByArea[task.responsible_area_id][status]++;
            tasksByArea[task.responsible_area_id].Total++;
        }
    });

    let content = `# Reporte de Tareas por Área Responsable\n`;
    content += `Fecha de Generación: ${new Date().toLocaleDateString('es-MX')}\n\n`;
    for (const areaId in tasksByArea) {
        const area = tasksByArea[areaId];
        if (area.Total > 0) {
            content += `
## ${area.name}
- **Total de Tareas:** ${area.Total}
- **Completadas:** ${area.Completada}
- **En Progreso:** ${area['En Progreso']}
- **Pendientes:** ${area.Pendiente}
- **Atrasadas:** ${area.Atrasada}
---
            `;
        }
    }
    return { title: 'Reporte de Tareas por Área Responsable', content };
};

const handleOverdueTasksReport = async (supabase) => {
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*, sub_tasks(*), responsible_person:profiles(full_name)');
    if (tasksError) throw tasksError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const overdueTasks = [];
    const upcomingTasks = [];

    tasks.forEach(task => {
        const status = getTaskStatus(task);
        if (status === 'Atrasada') {
            overdueTasks.push(task);
        } else if (status === 'Pendiente' || status === 'En Progreso') {
            if (task.scope?.due_date) {
                const dueDate = new Date(task.scope.due_date + 'T00:00:00');
                if (dueDate >= today && dueDate <= thirtyDaysFromNow) {
                    upcomingTasks.push(task);
                }
            }
        }
    });

    let content = `# Reporte de Tareas Críticas\n`;
    content += `Fecha de Generación: ${new Date().toLocaleDateString('es-MX')}\n\n`;

    content += `## Tareas Vencidas (${overdueTasks.length})\n`;
    if (overdueTasks.length === 0) {
        content += "No hay tareas vencidas.\n";
    } else {
        overdueTasks.forEach(task => {
            content += `
- **Tarea:** ${task.description}
  - **Responsable:** ${task.responsible_person?.full_name || 'No asignado'}
  - **Fecha de Vencimiento:** ${new Date(task.scope?.due_date + 'T00:00:00').toLocaleDateString('es-MX')}
---
`;
        });
    }

    content += `\n## Tareas con Vencimiento en los Próximos 30 Días (${upcomingTasks.length})\n`;
    if (upcomingTasks.length === 0) {
        content += "No hay tareas con vencimiento próximo.\n";
    } else {
        upcomingTasks.sort((a,b) => new Date(a.scope.due_date) - new Date(b.scope.due_date)).forEach(task => {
            content += `
- **Tarea:** ${task.description}
  - **Responsable:** ${task.responsible_person?.full_name || 'No asignado'}
  - **Fecha de Vencimiento:** ${new Date(task.scope?.due_date + 'T00:00:00').toLocaleDateString('es-MX')}
---
`;
        });
    }

    return { title: 'Reporte de Tareas Vencidas y Próximas', content };
};

const handleAuditFindingsReport = async (supabase) => {
    const { data: findings, error: findingsError } = await supabase
        .from('audit_findings')
        .select('*, audits!inner(name, scope_level, scope_entity)')
        .eq('status', 'Abierto')
        .order('severity', { ascending: false });
    
    if (findingsError) throw findingsError;

    let content = `# Reporte de Hallazgos de Auditoría Abiertos\n`;
    content += `Fecha de Generación: ${new Date().toLocaleDateString('es-MX')}\n\n`;

    if (findings.length === 0) {
        content += "Felicidades, no hay hallazgos de auditoría abiertos.\n";
    } else {
        const findingsByAudit = findings.reduce((acc, finding) => {
            const auditName = finding.audits.name;
            if (!acc[auditName]) {
                acc[auditName] = [];
            }
            acc[auditName].push(finding);
            return acc;
        }, {});

        for (const auditName in findingsByAudit) {
            content += `## Auditoría: ${auditName}\n`;
            findingsByAudit[auditName].forEach(finding => {
                content += `
- **Hallazgo:** ${finding.description}
  - **Severidad:** ${finding.severity}
  - **Recomendación:** ${finding.recommendation}
---
`;
            });
        }
    }
    return { title: 'Reporte de Hallazgos de Auditoría Abiertos', content };
};

const handleWorkloadByPersonReport = async (supabase) => {
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, full_name');
    if (profilesError) throw profilesError;
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*, sub_tasks(*)');
    if (tasksError) throw tasksError;

    const workload = {};
    profiles.forEach(p => {
        workload[p.id] = { 
            name: p.full_name,
            mainTasks: { Pendiente: 0, 'En Progreso': 0, Completada: 0, Atrasada: 0, Total: 0 },
            subTasks: { Pendiente: 0, 'En Progreso': 0, Completada: 0, Total: 0 },
        };
    });

    tasks.forEach(task => {
        // Main task workload
        const responsibleId = task.responsible_person_id;
        if (responsibleId && workload[responsibleId]) {
            const status = getTaskStatus(task);
            workload[responsibleId].mainTasks[status]++;
            workload[responsibleId].mainTasks.Total++;
        }
        // Sub-task workload
        task.sub_tasks.forEach(subtask => {
            const assigneeId = subtask.assigned_to_id;
            if (assigneeId && workload[assigneeId]) {
                workload[assigneeId].subTasks[subtask.status]++;
                workload[assigneeId].subTasks.Total++;
            }
        });
    });

    let content = `# Reporte de Carga de Trabajo por Persona\n`;
    content += `Fecha de Generación: ${new Date().toLocaleDateString('es-MX')}\n\n`;

    for (const personId in workload) {
        const person = workload[personId];
        const totalMainTasks = person.mainTasks.Total;
        const totalSubTasks = person.subTasks.Total;
        if (totalMainTasks > 0 || totalSubTasks > 0) {
            content += `## ${person.name}\n`;
            if (totalMainTasks > 0) {
                content += `
### Tareas Principales Asignadas (${totalMainTasks})
- **Completadas:** ${person.mainTasks.Completada}
- **En Progreso:** ${person.mainTasks['En Progreso']}
- **Pendientes:** ${person.mainTasks.Pendiente}
- **Atrasadas:** ${person.mainTasks.Atrasada}
`;
            }
            if (totalSubTasks > 0) {
                 content += `
### Sub-Tareas Asignadas (${totalSubTasks})
- **Completadas:** ${person.subTasks.Completada}
- **En Progreso:** ${person.subTasks['En Progreso']}
- **Pendientes:** ${person.subTasks.Pendiente}
`;
            }
            content += `---
`;
        }
    }
    return { title: 'Reporte de Carga de Trabajo por Persona', content };
};

// --- MAIN HANDLER ---
Deno.serve(async (req) => {
    const corsHeaders = buildCorsHeadersForRequest(req, { 'Access-Control-Allow-Methods': 'POST,OPTIONS' });
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
        const { query, reportType } = await req.json();
        const supabase = getSupabaseClient(req);

        // --- Handle Predefined Reports ---
        if (reportType) {
            let reportData;
            switch(reportType) {
                case 'general_status':
                    reportData = await handleGeneralStatusReport(supabase);
                    break;
                case 'tasks_by_area':
                     reportData = await handleTasksByAreaReport(supabase);
                     break;
                case 'overdue_tasks':
                    reportData = await handleOverdueTasksReport(supabase);
                    break;
                case 'audit_findings':
                    reportData = await handleAuditFindingsReport(supabase);
                    break;
                case 'workload_by_person':
                    reportData = await handleWorkloadByPersonReport(supabase);
                    break;
                default:
                     return new Response(JSON.stringify({ error: `El tipo de reporte "${reportType}" no es reconocido.` }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
            }
             return new Response(JSON.stringify(reportData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }
        
        // --- Handle AI-driven Reports ---
        if (!query) {
            return new Response(JSON.stringify({ error: 'La consulta es requerida para reportes con IA' }), { 
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'GEMINI_API_KEY no configurada.' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const ai = new GoogleGenerativeAI(apiKey);

        // Step 1: Fetch relevant data from DB
        const [
            { data: tasks, error: tasksError },
            { data: audits, error: auditsError },
            { data: profiles, error: profilesError }
        ] = await Promise.all([
            supabase.from('tasks').select('*, sub_tasks(*), responsible_person:profiles(full_name), responsible_area:responsible_areas(name)'),
            supabase.from('audits').select('*, findings:audit_findings(*), auditor:profiles(full_name)'),
            supabase.from('profiles').select('id, full_name, role, scope_entity')
        ]);

        if (tasksError || auditsError || profilesError) {
            const errPayload: any = {
                error: 'Falló la obtención de datos para generar el reporte.',
                details: {
                    tasksError: tasksError?.message || null,
                    auditsError: auditsError?.message || null,
                    profilesError: profilesError?.message || null,
                }
            };
            console.error('DB fetch errors:', errPayload.details);
            return new Response(JSON.stringify(errPayload), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const dataContext = {
            tasks: (tasks || []).map(t => ({...t, status: getTaskStatus(t)})),
            audits,
            profiles
        };

        // Step 2: Generate report with Gemini using the data context
        const synthesisPrompt = `
Eres un analista de datos experto en sistemas de cumplimiento para instituciones educativas.
Tu tarea es generar un reporte en formato Markdown basado en la solicitud del usuario y los datos proporcionados.
Sé claro, conciso y profesional. Usa encabezados (#, ##), listas (*) y texto en negrita (**) para estructurar el reporte.

SOLICITUD DEL USUARIO: "${query}"

DATOS DISPONIBLES (en formato JSON):
${JSON.stringify(dataContext).substring(0, 30000)}

Genera el reporte en Markdown ahora. El reporte debe responder directamente a la solicitud del usuario usando los datos.
        `;

    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(synthesisPrompt);
    const reportContent = await result.response.text();
        const reportTitle = `Reporte de IA: ${query.substring(0, 50)}...`;

            return new Response(JSON.stringify({ title: reportTitle, content: reportContent }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
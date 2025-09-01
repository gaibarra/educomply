import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from 'npm:@supabase/supabase-js';
import { buildCorsHeadersForRequest } from "../_shared/cors.ts";

declare const Deno: any;

interface AuditRecord {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  scope_level: string;
  scope_entity: string | null;
  ai_description?: string | null;
}

const phases: string[] = ['planificacion', 'ejecucion', 'evaluacion', 'seguimiento'];

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeadersForRequest(req, { 'Access-Control-Allow-Methods': 'POST,OPTIONS' });
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { record: audit } = await req.json() as { record: AuditRecord };

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no está configurada.');
    }

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Eres un experto en auditorías de cumplimiento para instituciones educativas.
      Basado en los siguientes detalles de una auditoría, genera un plan de actividades detallado.

      Auditoría: "${audit.name}"
      Descripción: "${audit.ai_description || 'Auditoría de cumplimiento general'}"
      Fechas: del ${audit.start_date} al ${audit.end_date}
      Ámbito: ${audit.scope_level}${audit.scope_entity ? ` - ${audit.scope_entity}` : ''}

      Genera una lista de 3 a 5 actividades clave para CADA UNA de las siguientes 4 fases: ${phases.join(', ')}.
      
      Responde EXCLUSIVAMENTE con un objeto JSON que contenga un solo array llamado "activities".
      Cada objeto en el array debe tener los siguientes campos:
      - "phase": una de las 4 fases mencionadas.
      - "description": una descripción clara y concisa de la actividad.

      Ejemplo de la estructura de respuesta esperada:
      {
        "activities": [
          { "phase": "planificacion", "description": "Definir el equipo auditor y roles." },
          { "phase": "planificacion", "description": "Solicitar documentación preliminar." },
          { "phase": "ejecucion", "description": "Realizar entrevistas con el personal clave." },
          ...
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
      console.error('Error parsing AI response:', text);
      throw new Error('La respuesta de la IA no es un JSON válido.');
    }

    if (!parsedResponse || !Array.isArray(parsedResponse.activities)) {
      throw new Error('La respuesta de la IA no tiene la estructura esperada.');
    }

    const activitiesToInsert = parsedResponse.activities.map((activity: any) => ({
      audit_id: audit.id,
      phase: activity.phase,
      description: activity.description,
      completed: false,
    }));

    const { error } = await supabaseAdmin
      .from('audit_phase_activities')
      .insert(activitiesToInsert);

    if (error) {
      console.error('Error inserting activities:', error);
      throw new Error('No se pudieron guardar las actividades de la auditoría.');
    }

    return new Response(JSON.stringify({ success: true, message: `${activitiesToInsert.length} actividades generadas.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error general en la función:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

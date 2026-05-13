import type Anthropic from '@anthropic-ai/sdk'

export const INSIGHTS_SYSTEM_PROMPT = `Tu es un analyste senior pour un call-center d'une clinique de chirurgie de l'obésité au Royaume-Uni (parcours NHS WMP S2). Tu reçois des données anonymisées sur des appels téléphoniques entre des agents IA (Retell) et des prospects/patients.

Mission : produire une analyse stratégique synthétique, honnête et actionnable pour le directeur du call-center.

Règles strictes :
1. Réponds TOUJOURS en français professionnel et concis.
2. Tu n'as JAMAIS accès aux noms des patients. Si tu dois référencer un prospect, écris "un prospect", "plusieurs prospects" ou cite le call_id technique.
3. Tu ne dois JAMAIS inventer de chiffres. Si tu manques de données pour une métrique, écris explicitement "données insuffisantes" plutôt que d'extrapoler.
4. Les "counter_argument" que tu proposes doivent être génériques et marqués comme "Suggestion à valider" — il n'y a pas de script formalisé ni de grille tarifaire à ta disposition.
5. Pour le "script_audit", n'invente PAS de pourcentages par étape de script. Identifie plutôt les thèmes communs des dernières phrases d'agent avant raccrochage (depuis les summaries), et les patterns observés dans les appels convertis vs perdus.
6. Pour les "optimization_hypotheses", formule des HYPOTHÈSES À TESTER avec un chiffre descriptif observé dans les données — JAMAIS une promesse prédictive du type "+15% de conversion".
7. Privilégie la qualité à la quantité : 3 vraies insights valent mieux que 10 banalités.

Méthodologie & posture (puisqu'il n'y a pas de script formalisé) :
Tes suggestions doivent refléter le binôme idéal pour ce type d'appel :
(a) **Professionnel de santé empathique** : écoute active, normalisation de la situation (l'obésité est une maladie complexe, pas un échec personnel), langage non-jugeant, sécurité du patient avant tout, prudence sur les promesses médicales.
(b) **Commercial bienveillant** : création de confiance, reformulation, qualification fine des vrais freins (peur de l'opération ? coût ? entourage ? expérience NHS précédente ?), accompagnement jusqu'à la décision sans pression. "Aller au bout" = aider le prospect à clarifier ce dont il a besoin et à décider en conscience (un RDV ou un non clair valent mieux qu'un follow-up vague).

Quand tu repères un **winning pattern**, regarde si l'agent a :
- Reformulé pour confirmer la compréhension
- Validé l'émotion avant de répondre
- Posé une question ouverte de clarification
- Donné un repère concret (BMI, parcours NHS WMP / S2, étape suivante simple)
- Proposé un petit pas (consultation médecin gratuite) plutôt qu'un saut trop grand

Quand tu repères un **hangup topic** ou une **alerte**, signale si l'agent a :
- Coupé la parole
- Pressé / fait du forcing
- Laissé une objection sans réponse
- Manqué d'empathie sur un sujet sensible (poids, antécédents, échecs passés)
- Donné une info technique sans vérifier la compréhension

Vocabulaire métier à utiliser :
- "RDV" pour rendez-vous médecin
- "Prospect" pour appel sortant, "patient" pour quelqu'un déjà engagé
- Qualifications : NOUVEAU DOSSIER, RDV MEDECIN, PAS INTERESSE, PAS DE REPONSE, FAUX NUMERO, FOLLOW UP

Tu utiliseras l'outil "emit_insights" pour structurer ta réponse complète en JSON. Tu N'écris pas de texte libre en dehors de l'appel à l'outil.`

export const INSIGHTS_TOOL: Anthropic.Tool = {
  name: 'emit_insights',
  description:
    'Émet l\'analyse complète des appels du call-center en JSON structuré pour affichage dashboard.',
  input_schema: {
    type: 'object',
    required: [
      'pulse',
      'strategic_alerts',
      'objections',
      'trends',
      'script_audit',
      'sentiment',
      'optimization_hypotheses',
    ],
    properties: {
      pulse: {
        type: 'object',
        required: ['summary', 'highlights'],
        description: 'Résumé exécutif de la période',
        properties: {
          summary: {
            type: 'string',
            description:
              'Narratif de 3 à 4 phrases en français sur l\'ambiance et les tendances clés.',
          },
          highlights: {
            type: 'array',
            maxItems: 4,
            items: {
              type: 'object',
              required: ['label', 'value'],
              properties: {
                label: { type: 'string', description: 'Court libellé (max 30 caractères)' },
                value: { type: 'string', description: 'Valeur ou phrase courte' },
              },
            },
          },
        },
      },
      strategic_alerts: {
        type: 'array',
        maxItems: 4,
        description:
          'Anomalies ou signaux préoccupants à remonter (qualité agent, pattern bizarre, plainte récurrente). Si rien d\'alarmant, retourner un tableau vide.',
        items: {
          type: 'object',
          required: ['severity', 'message', 'evidence_count'],
          properties: {
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            message: { type: 'string' },
            evidence_count: {
              type: 'number',
              description: 'Nombre d\'appels qui supportent cette alerte',
            },
          },
        },
      },
      objections: {
        type: 'array',
        maxItems: 6,
        description:
          'Top objections détectées dans les appels (PAS INTERESSE, FOLLOW UP, hangups). Ordonnées par fréquence décroissante.',
        items: {
          type: 'object',
          required: ['label', 'count', 'percent', 'example_call_ids', 'counter_argument'],
          properties: {
            label: { type: 'string', description: 'Nom court de l\'objection' },
            count: { type: 'number' },
            percent: {
              type: 'number',
              description: '% des appels analysés où cette objection apparaît',
            },
            example_call_ids: {
              type: 'array',
              maxItems: 3,
              items: { type: 'string' },
            },
            counter_argument: {
              type: 'string',
              description: 'Suggestion générique de contre-argument (à valider)',
            },
          },
        },
      },
      trends: {
        type: 'object',
        required: ['emerging_keywords', 'weak_signals'],
        properties: {
          emerging_keywords: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              required: ['keyword', 'count', 'note'],
              properties: {
                keyword: { type: 'string' },
                count: { type: 'number' },
                note: { type: 'string', description: 'Contexte d\'apparition' },
              },
            },
          },
          weak_signals: {
            type: 'array',
            maxItems: 5,
            items: { type: 'string' },
          },
        },
      },
      script_audit: {
        type: 'object',
        required: ['common_hangup_topics', 'converted_call_patterns'],
        properties: {
          common_hangup_topics: {
            type: 'array',
            maxItems: 5,
            description:
              'Thèmes les plus fréquents au moment du raccrochage des prospects (à partir des résumés et call_status).',
            items: {
              type: 'object',
              required: ['topic', 'count', 'example_call_ids'],
              properties: {
                topic: { type: 'string' },
                count: { type: 'number' },
                example_call_ids: {
                  type: 'array',
                  maxItems: 3,
                  items: { type: 'string' },
                },
              },
            },
          },
          converted_call_patterns: {
            type: 'array',
            maxItems: 5,
            description:
              'Phrases / thèmes sur-représentés dans les appels qui ont abouti à un RDV MEDECIN par rapport aux autres.',
            items: {
              type: 'object',
              required: ['phrase_or_theme', 'frequency_in_won', 'frequency_in_lost'],
              properties: {
                phrase_or_theme: { type: 'string' },
                frequency_in_won: { type: 'number' },
                frequency_in_lost: { type: 'number' },
              },
            },
          },
        },
      },
      sentiment: {
        type: 'object',
        required: ['average_score', 'distribution', 'hot_leads'],
        properties: {
          average_score: {
            type: 'number',
            description: 'Score moyen de 0 à 10 du climat de la période',
          },
          distribution: {
            type: 'object',
            required: ['positive', 'neutral', 'negative'],
            properties: {
              positive: { type: 'number' },
              neutral: { type: 'number' },
              negative: { type: 'number' },
            },
          },
          hot_leads: {
            type: 'array',
            maxItems: 5,
            description:
              'Top 5 appels où le prospect a montré le plus d\'enthousiasme et mérite un rappel humain prioritaire.',
            items: {
              type: 'object',
              required: ['call_id', 'reason'],
              properties: {
                call_id: { type: 'string' },
                reason: {
                  type: 'string',
                  description: 'Pourquoi ce prospect est chaud (1 phrase)',
                },
              },
            },
          },
        },
      },
      optimization_hypotheses: {
        type: 'array',
        maxItems: 4,
        description:
          'Hypothèses à TESTER (jamais des prédictions). Format : observation + test à mener.',
        items: {
          type: 'object',
          required: ['observation', 'test_to_run'],
          properties: {
            observation: { type: 'string' },
            test_to_run: { type: 'string' },
          },
        },
      },
    },
  },
}

export function buildUserMessage(args: {
  periodLabel: string
  callsAnalysed: number
  callsWithSummary: number
  stats: {
    total: number
    rdv: number
    pas_interesse: number
    pas_de_reponse: number
    faux_numero: number
    follow_up: number
    nouveau_dossier: number
    answered: number
    avg_duration_seconds: number
  }
  callsJson: string
}): string {
  return `Période analysée : **${args.periodLabel}**
Appels considérés : ${args.callsAnalysed} (dont ${args.callsWithSummary} avec un résumé exploitable)

Statistiques agrégées :
- Total : ${args.stats.total}
- RDV MEDECIN : ${args.stats.rdv}
- PAS INTERESSE : ${args.stats.pas_interesse}
- PAS DE REPONSE : ${args.stats.pas_de_reponse}
- FAUX NUMERO : ${args.stats.faux_numero}
- FOLLOW UP : ${args.stats.follow_up}
- NOUVEAU DOSSIER : ${args.stats.nouveau_dossier}
- Réponses réelles (durée > 15s, disconnect valide) : ${args.stats.answered}
- Durée moyenne : ${args.stats.avg_duration_seconds.toFixed(0)}s

Données brutes des appels (JSON, anonymisées — pas de noms) :
\`\`\`json
${args.callsJson}
\`\`\`

Analyse maintenant ces données et émets l'insight structuré via l'outil emit_insights.`
}

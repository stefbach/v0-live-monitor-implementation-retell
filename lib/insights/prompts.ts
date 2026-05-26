import type Anthropic from '@anthropic-ai/sdk'
import { BUSINESS_CONTEXT, hasBusinessContext } from './business-context'

const BASE_SYSTEM_PROMPT = `Tu es un analyste senior pour un call-center d'une clinique de chirurgie de l'obésité au Royaume-Uni (parcours NHS WMP S2). Tu reçois des données anonymisées sur des appels téléphoniques entre des agents IA (Retell) et des prospects/patients.

Mission : produire une analyse stratégique synthétique, honnête et actionnable pour le directeur du call-center.

Règles strictes :
1. Réponds TOUJOURS en français professionnel et concis.
2. Si tu références un prospect, utilise son nom seulement s'il apparaît dans le résumé d'un appel ; sinon écris "un prospect" ou cite le call_id technique.
3. Tu ne dois JAMAIS inventer de chiffres. Si tu manques de données pour une métrique, écris explicitement "données insuffisantes" plutôt que d'extrapoler.
4. Les "counter_argument" que tu proposes doivent être marqués comme "Suggestion à valider".
5. Pour le "script_audit", n'invente PAS de pourcentages par étape de script. Identifie plutôt les thèmes communs des dernières phrases d'agent avant raccrochage (depuis les summaries), et les patterns observés dans les appels convertis vs perdus.
6. Pour les "optimization_hypotheses", formule des HYPOTHÈSES À TESTER avec un chiffre descriptif observé dans les données — JAMAIS une promesse prédictive du type "+15% de conversion".
7. Privilégie la qualité à la quantité : 3 vraies insights valent mieux que 10 banalités.
8. Tu DOIS répondre uniquement en appelant l'outil "emit_insights" avec un JSON conforme au schéma. N'écris AUCUN texte libre en dehors de l'appel à l'outil.
9. SENTIMENT — le champ "sentiment" en entrée est presque toujours null (Retell ne le calcule pas). TU DOIS inférer toi-même le sentiment de chaque appel à partir de son résumé (positif / neutre / négatif) puis remplir sentiment.distribution avec le nombre d'appels dans chaque catégorie (somme = nombre d'appels avec résumé). Calcule sentiment.average_score sur une échelle 0-10 (0 = très négatif, 5 = neutre, 10 = très positif). Identifie 3 à 5 sentiment.hot_leads : prospects qui ont montré un intérêt clair, posé des questions concrètes, demandé un rappel précis, ou évoqué une intention forte d'opération — cite leur call_id et la raison observée.

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
- Donné une info technique sans vérifier la compréhension`

const INSIGHTS_VOCAB = `
Vocabulaire métier :
- "RDV" pour rendez-vous médecin
- "Prospect" pour appel sortant, "patient" pour quelqu'un déjà engagé
- Qualifications : NOUVEAU DOSSIER, RDV MEDECIN, PAS INTERESSE, PAS DE REPONSE, FAUX NUMERO, FOLLOW UP, TRANSFERRED_TO_ISABELLE`

export function buildSystemPrompt(): string {
  const parts = [BASE_SYSTEM_PROMPT, INSIGHTS_VOCAB]
  if (hasBusinessContext()) {
    parts.push(
      '\n──────────────────────────\nContexte métier spécifique à cette clinique (fournit par l\'équipe — à respecter strictement) :\n\n' +
        BUSINESS_CONTEXT
    )
  }
  return parts.join('\n')
}

// Anthropic Claude tool definition format
export const INSIGHTS_TOOL: Anthropic.Tool = {
  name: 'emit_insights',
  description:
    "Émet l'analyse complète des appels du call-center en JSON structuré pour affichage dashboard.",
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
          properties: {
            summary: {
              type: 'string',
              description:
                "Narratif de 3 à 4 phrases en français sur l'ambiance et les tendances clés.",
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
            "Anomalies ou signaux préoccupants (qualité agent, pattern bizarre, plainte récurrente). Tableau vide si rien d'alarmant.",
          items: {
            type: 'object',
            required: ['severity', 'message', 'evidence_count'],
            properties: {
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              message: { type: 'string' },
              evidence_count: { type: 'number' },
            },
          },
        },
        objections: {
          type: 'array',
          maxItems: 6,
          description:
            "Top objections détectées (PAS INTERESSE, FOLLOW UP, hangups). Ordonnées par fréquence décroissante.",
          items: {
            type: 'object',
            required: ['label', 'count', 'percent', 'example_call_ids', 'counter_argument'],
            properties: {
              label: { type: 'string' },
              count: { type: 'number' },
              percent: { type: 'number' },
              example_call_ids: {
                type: 'array',
                maxItems: 3,
                items: { type: 'string' },
              },
              counter_argument: {
                type: 'string',
                description: 'Suggestion à valider — bienveillante, sans pression',
              },
            },
          },
        },
        trends: {
          type: 'object',
          required: ['emerging_keywords', 'weak_signals'],
          description:
            "OBLIGATOIRE — analyse les résumés pour identifier les sujets qui reviennent. Ne renvoie JAMAIS de tableau vide tant qu'il y a au moins 5 résumés exploitables.",
          properties: {
            emerging_keywords: {
              type: 'array',
              minItems: 3,
              maxItems: 8,
              description:
                'Au moins 3 mots ou expressions qui reviennent souvent dans les résumés (ex. BMI, NHS, coût, peur, conjoint, opération, ballon, Ozempic, follow up, etc.).',
              items: {
                type: 'object',
                required: ['keyword', 'count', 'note'],
                properties: {
                  keyword: { type: 'string', description: 'Le mot ou la courte expression' },
                  count: {
                    type: 'number',
                    description: 'Nombre approximatif de résumés où il apparaît',
                  },
                  note: {
                    type: 'string',
                    description: 'Phrase courte expliquant pourquoi ce mot est notable',
                  },
                },
              },
            },
            weak_signals: {
              type: 'array',
              minItems: 2,
              maxItems: 5,
              description:
                "Au moins 2 phrases-observations sur des patterns subtils détectés dans les résumés (ex. 'plusieurs prospects mentionnent leur conjoint comme frein', 'plusieurs raccrochages juste après évocation du BMI minimum').",
              items: { type: 'string' },
            },
          },
        },
        script_audit: {
          type: 'object',
          required: ['common_hangup_topics', 'converted_call_patterns'],
          description:
            "OBLIGATOIRE — analyse les résumés des appels raccrochés courts vs ceux qui ont mené à un RDV. Ne renvoie JAMAIS de tableau vide tant qu'il y a au moins 5 résumés exploitables.",
          properties: {
            common_hangup_topics: {
              type: 'array',
              minItems: 2,
              maxItems: 5,
              description:
                "Au moins 2 thèmes qui reviennent juste avant un raccrochage ou un refus (depuis les résumés des appels PAS INTERESSE, FOLLOW UP, courts, etc.).",
              items: {
                type: 'object',
                required: ['topic', 'count', 'example_call_ids'],
                properties: {
                  topic: {
                    type: 'string',
                    description: 'Le thème ou sujet qui apparaît avant raccrochage',
                  },
                  count: { type: 'number', description: "Nombre d'appels concernés" },
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
              minItems: 2,
              maxItems: 5,
              description:
                "Au moins 2 phrases ou comportements observés dans les résumés des appels RDV MEDECIN (reformulation, validation émotion, proposition d'un petit pas, etc.). Si zéro RDV dans le corpus, indique-le dans phrase_or_theme.",
              items: {
                type: 'object',
                required: ['phrase_or_theme', 'frequency_in_won', 'frequency_in_lost'],
                properties: {
                  phrase_or_theme: {
                    type: 'string',
                    description: 'La phrase, le thème ou le comportement observé',
                  },
                  frequency_in_won: {
                    type: 'number',
                    description: 'Nombre approximatif d\'appels RDV où il apparaît',
                  },
                  frequency_in_lost: {
                    type: 'number',
                    description: 'Nombre approximatif d\'appels perdus où il apparaît',
                  },
                },
              },
            },
          },
        },
        sentiment: {
          type: 'object',
          required: ['average_score', 'distribution', 'hot_leads'],
          description:
            "OBLIGATOIRE — tu DOIS inférer le sentiment à partir des résumés textuels. Ne renvoie JAMAIS 0/0/0 quand le corpus contient des résumés exploitables.",
          properties: {
            average_score: {
              type: 'number',
              description:
                "Score moyen 0-10 calculé en lisant les résumés (0 = très négatif, 5 = neutre, 10 = très positif). DOIT être > 0 dès qu'il y a au moins 1 résumé.",
            },
            distribution: {
              type: 'object',
              required: ['positive', 'neutral', 'negative'],
              description:
                'Compte d\'appels classés positif / neutre / négatif. La somme DOIT être égale au nombre d\'appels avec un résumé exploitable.',
              properties: {
                positive: { type: 'number', description: "Nombre d'appels positifs" },
                neutral: { type: 'number', description: "Nombre d'appels neutres" },
                negative: { type: 'number', description: "Nombre d'appels négatifs" },
              },
            },
            hot_leads: {
              type: 'array',
              minItems: 3,
              maxItems: 5,
              description:
                '3 à 5 prospects chauds à rappeler en priorité : intérêt clair, question concrète, demande de rappel précis, ou intention forte exprimée dans le résumé.',
              items: {
                type: 'object',
                required: ['call_id', 'reason'],
                properties: {
                  call_id: {
                    type: 'string',
                    description: "L'identifiant exact du call_id source",
                  },
                  reason: {
                    type: 'string',
                    description: 'Phrase courte expliquant pourquoi ce lead est chaud',
                  },
                },
              },
            },
          },
        },
        optimization_hypotheses: {
          type: 'array',
          maxItems: 4,
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

Données brutes des appels (JSON) :
\`\`\`json
${args.callsJson}
\`\`\`

Analyse maintenant ces données et émets l'insight structuré via l'outil emit_insights.`
}

# Follow-up history retention

25 October 2026: continued the approved recursive interview work. The prior API kept only 200 characters of each question and 400 of each answer. A 2,486-character synthetic answer lost its closing rollback criterion.

The replacement retains up to four recent turns, up to 2,000 question and 6,000 answer characters, within a 24,000-character total budget. Oversized turns retain opening and closing text with an explicit middle-omission marker. Old turns dropped by the budget are marked. Generated history remains unverified context, never personal evidence.

Five focused behavioral tests pass. TypeScript passes. Full regression suite passes 945/945. Publication pending. Native desktop and actual generated-answer quality are not established. Master advanced to 4d6e433 during this run; reconcile concurrent changes before publication.

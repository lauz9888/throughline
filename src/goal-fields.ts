import { buildTextField, createTooltipController } from './field-kit';

export const BLURB_TEXT =
  'A goal is a specific, measurable, significant achievement with a clear and distinct ' +
  "completion point — for example 'get promoted to manager', 'run a marathon', or 'be " +
  "awarded a degree'.";

export const TITLE_TOOLTIP_TEXT =
  "A short, memorable name for this goal — for example 'Get promoted to manager'.";
export const DESCRIPTION_TOOLTIP_TEXT =
  'Optional. Add more detail about what achieving this goal looks like.';
export const REASON_TOOLTIP_TEXT =
  'Optional. Explain why this goal matters to you — this can help keep you motivated.';

export interface GoalFieldsResult {
  titleField: HTMLElement;
  descriptionField: HTMLElement;
  reasonField: HTMLElement;
  titleInput: HTMLInputElement;
  descriptionInput: HTMLTextAreaElement;
  reasonInput: HTMLTextAreaElement;
  titleIcon: HTMLButtonElement;
  titleTooltip: HTMLElement;
  descriptionIcon: HTMLButtonElement;
  descriptionTooltip: HTMLElement;
  reasonIcon: HTMLButtonElement;
  reasonTooltip: HTMLElement;
  isTooltipOpen: () => boolean;
  hideOpenTooltip: () => boolean;
  handleDocumentClickForTooltip: (event: MouseEvent) => void;
}

// Mirrors `buildAspirationFields`'s shape, with goal-specific copy.
export function buildGoalFields(
  doc: Document,
  idPrefix: string,
  initialValues?: { title?: string; description?: string; reason?: string },
): GoalFieldsResult {
  const tooltipController = createTooltipController();

  const title = buildTextField(
    doc,
    {
      idPrefix,
      fieldKey: 'title',
      labelText: 'Title',
      controlType: 'input',
      tooltipText: TITLE_TOOLTIP_TEXT,
      required: true,
      initialValue: initialValues?.title,
    },
    tooltipController,
  );

  const description = buildTextField(
    doc,
    {
      idPrefix,
      fieldKey: 'description',
      labelText: 'Description',
      controlType: 'textarea',
      tooltipText: DESCRIPTION_TOOLTIP_TEXT,
      initialValue: initialValues?.description,
    },
    tooltipController,
  );

  const reason = buildTextField(
    doc,
    {
      idPrefix,
      fieldKey: 'reason',
      labelText: 'Reason',
      controlType: 'textarea',
      tooltipText: REASON_TOOLTIP_TEXT,
      initialValue: initialValues?.reason,
    },
    tooltipController,
  );

  return {
    titleField: title.field,
    descriptionField: description.field,
    reasonField: reason.field,
    titleInput: title.input as HTMLInputElement,
    descriptionInput: description.input as HTMLTextAreaElement,
    reasonInput: reason.input as HTMLTextAreaElement,
    titleIcon: title.icon,
    titleTooltip: title.tooltip,
    descriptionIcon: description.icon,
    descriptionTooltip: description.tooltip,
    reasonIcon: reason.icon,
    reasonTooltip: reason.tooltip,
    isTooltipOpen: tooltipController.isTooltipOpen,
    hideOpenTooltip: tooltipController.hideOpenTooltip,
    handleDocumentClickForTooltip: tooltipController.handleDocumentClickForTooltip,
  };
}

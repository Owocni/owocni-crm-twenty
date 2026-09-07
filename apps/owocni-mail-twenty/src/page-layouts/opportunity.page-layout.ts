import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  OPPORTUNITY_ACTIONS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_ACTIONS_WIDGET_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_HOME_FIELDS_WIDGET_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_HOME_TAB_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_MAIL_TAB_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_MAIL_WIDGET_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_NOTES_TAB_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_NOTES_WIDGET_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_TASKS_TAB_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_TASKS_WIDGET_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_TIMELINE_TAB_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_TIMELINE_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

/**
 * Replaces Twenty's system Opportunity record page (first non-system RECORD_PAGE wins).
 * Rollback: delete this file and re-apply the app — command-menu Odpowiedz stays.
 */
export default definePageLayout({
  universalIdentifier: OPPORTUNITY_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Owocni Opportunity',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  defaultTabToFocusOnMobileAndSidePanelUniversalIdentifier:
    OPPORTUNITY_MAIL_TAB_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier: OPPORTUNITY_HOME_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Home',
      position: 10,
      icon: 'IconHome',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: OPPORTUNITY_ACTIONS_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              OPPORTUNITY_ACTIONS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
        {
          universalIdentifier: OPPORTUNITY_HOME_FIELDS_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Fields',
          type: 'FIELDS',
          configuration: {
            configurationType: 'FIELDS',
            // Workspace view "Opportunity Record Page Fields" (Lead / Status / Więcej).
            viewId: 'fce925c5-5d4e-51df-a589-69f6bb7ecc90',
            // Server expects this key; viewId alone is stored as null (Twenty #21095).
            viewUniversalIdentifier: 'fce925c5-5d4e-51df-a589-69f6bb7ecc90',
          } as { configurationType: 'FIELDS'; viewId: string },
        },
      ],
    },
    {
      universalIdentifier: OPPORTUNITY_MAIL_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Mail',
      position: 15,
      icon: 'IconMail',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: OPPORTUNITY_MAIL_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              OPPORTUNITY_MAIL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
    {
      universalIdentifier: OPPORTUNITY_NOTES_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Notes',
      position: 16,
      icon: 'IconNotes',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: OPPORTUNITY_NOTES_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Notes',
          type: 'NOTES',
          configuration: {
            configurationType: 'NOTES',
          },
        },
      ],
    },
    {
      universalIdentifier: OPPORTUNITY_TIMELINE_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Timeline',
      position: 17,
      icon: 'IconTimelineEvent',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: OPPORTUNITY_TIMELINE_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Timeline',
          type: 'TIMELINE',
          configuration: {
            configurationType: 'TIMELINE',
          },
        },
      ],
    },
    {
      universalIdentifier: OPPORTUNITY_TASKS_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Tasks',
      position: 18,
      icon: 'IconCheckbox',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: OPPORTUNITY_TASKS_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Tasks',
          type: 'TASKS',
          configuration: {
            configurationType: 'TASKS',
          },
        },
      ],
    },
  ],
});

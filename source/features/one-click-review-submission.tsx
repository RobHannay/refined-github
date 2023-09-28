import React from 'dom-chef';
import delegate, {DelegateEvent} from 'delegate-it';
import * as pageDetect from 'github-url-detection';
import {CheckIcon, FileDiffIcon} from '@primer/octicons-react';

import features from '../feature-manager.js';
import observe from '../helpers/selector-observer.js';

function replaceCheckboxes(originalSubmitButton: HTMLButtonElement): void {
	const form = originalSubmitButton.form!;
	const actionsRow = originalSubmitButton.closest('.form-actions')!;

	// Do not use `select.all` because elements can be outside `form`
	// `RadioNodeList` is dynamic, so we need to make a copy
	const radios = [...form.elements.namedItem('pull_request_review[event]') as RadioNodeList] as HTMLInputElement[];
	if (radios.length === 0) {
		features.log.error(import.meta.url, 'Could not find radio buttons');
		return;
	}

	// Set the default action for cmd+enter to Comment
	if (radios.length > 1) {
		form.prepend(
			<input
				type="hidden"
				name="pull_request_review[event]"
				value="comment"
			/>,
		);
	}

	const formAttribute = originalSubmitButton.getAttribute('form')!;

	// Generate the new buttons
	for (const radio of radios) {
		const labelNode = radio.labels?.[0];

		// new ?? old. Backwards-compat tooltip content queries. Issue #6963
		const tooltip = labelNode?.nextElementSibling?.textContent ?? radio.parentElement!.getAttribute('aria-label');

		const classes = ['btn btn-sm'];
		if (radio.value === 'comment') {
			classes.push('btn-primary');
		}

		if (tooltip) {
			classes.push('tooltipped tooltipped-nw tooltipped-no-delay');
		}

		const button = (
			<button
				type="submit"
				name="pull_request_review[event]"
				// Old version of GH don't nest the submit button inside the form, so must be linked manually. Issue #6963.
				form={formAttribute}
				value={radio.value}
				className={classes.join(' ')}
				aria-label={tooltip!}
				disabled={radio.disabled}
			>
				{/* new ?? old. Backwards-compat label content queries. Issue #6963. */}
				{labelNode?.textContent ?? radio.nextSibling}
			</button>
		);

		if (!radio.disabled && radio.value === 'approve') {
			button.prepend(<CheckIcon className="color-fg-success"/>);
		} else if (!radio.disabled && radio.value === 'reject') {
			button.prepend(<FileDiffIcon className="color-fg-danger"/>);
		}

		actionsRow.append(button);
	}

	// Remove original fields at last to avoid leaving a broken form
	const fieldset = radios[0].closest('fieldset');

	if (fieldset) {
		fieldset.remove();
	} else {
		// To retain backwards compatibility with older GHE versions, remove any radios not within a fieldset. Issue #6963.
		for (const radio of radios) {
			radio.closest('.form-checkbox')!.remove();
		}
	}

	originalSubmitButton.remove();
}

let lastSubmission: number | undefined;
function blockDuplicateSubmissions(event: DelegateEvent): void {
	if (lastSubmission && Date.now() - lastSubmission < 1000) {
		event.preventDefault();
		console.log('Duplicate submission prevented');
		return;
	}

	lastSubmission = Date.now();
}

function init(signal: AbortSignal): void {
	// The selector excludes the "Cancel" button
	observe('#review-changes-modal [type="submit"]:not([name])', replaceCheckboxes, {signal});
	delegate('#review-changes-modal form', 'submit', blockDuplicateSubmissions, {signal});
}

void features.add(import.meta.url, {
	include: [
		pageDetect.isPRFiles,
	],
	awaitDomReady: true,
	init,
});

/*

Test URLs

https://github.com/refined-github/sandbox/pull/4/files
https://github.com/refined-github/sandbox/pull/12/files

*/

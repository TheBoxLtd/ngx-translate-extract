import { ParserInterface } from './parser.interface';
import { TranslationCollection } from '..';
import { isPathAngularComponent, extractComponentInlineTemplate, pugConverterParser } from '..';

import { parseTemplate, TmplAstNode, TmplAstElement, TmplAstTextAttribute } from '@angular/compiler';

export class DirectiveParser implements ParserInterface {
	public extract(source: string, filePath: string): TranslationCollection | null {
		source = pugConverterParser(source, filePath);

		if (filePath && isPathAngularComponent(filePath)) {
			source = extractComponentInlineTemplate(source);
		}

		let collection: TranslationCollection = new TranslationCollection();

		const nodes: TmplAstNode[] = this.parseTemplate(source, filePath);
		this.getTranslatableElements(nodes).forEach(element => {
			const getElementTranslateAttrValue = this.getElementTranslateAttrValue(element); // translate
			const getElementContents = this.getElementContents(element);
			let key;
			if (getElementTranslateAttrValue && getElementContents) {
				key = getElementTranslateAttrValue === 'translate' ? getElementContents : getElementTranslateAttrValue;
			} else {
				key = getElementTranslateAttrValue || getElementContents;
			}
			collection = collection.add(key);
		});

		return collection;
	}

	protected getTranslatableElements(nodes: TmplAstNode[]): TmplAstElement[] {
		return nodes
			.filter(element => this.isElement(element))
			.reduce((result: TmplAstElement[], element: TmplAstElement) => {
				return result.concat(this.findChildrenElements(element));
			}, [])
			.filter(element => this.isTranslatable(element));
	}

	protected findChildrenElements(node: TmplAstNode): TmplAstElement[] {
		if (!this.isElement(node)) {
			return [];
		}

		// If element has translate attribute all its contents is translatable
		// so we don't need to traverse any deeper
		if (this.isTranslatable(node)) {
			return [node];
		}

		return node.children.reduce(
			(result: TmplAstElement[], childNode: TmplAstNode) => {
				if (this.isElement(childNode)) {
					const children = this.findChildrenElements(childNode);
					return result.concat(children);
				}
				return result;
			},
			[node]
		);
	}

	protected parseTemplate(template: string, path: string): TmplAstNode[] {
		return parseTemplate(template, path).nodes;
	}

	protected isElement(node: any): node is TmplAstElement {
		return node && node.attributes !== undefined && node.children !== undefined;
	}

	protected isTranslatable(node: TmplAstNode): boolean {
		return this.isElement(node) && node.attributes.some(attribute => attribute.name === 'translate');
	}

	protected getElementTranslateAttrValue(element: TmplAstElement): string {
		const attr: TmplAstTextAttribute = element.attributes.find(attribute => attribute.name === 'translate');
		return (attr && attr.value) || '';
	}

	protected getElementContents(element: TmplAstElement): string {
		const contents = element.sourceSpan.start.file.content;
		const start = element.startSourceSpan.end.offset;
		const end = element.endSourceSpan.start.offset;
		return contents.substring(start, end).trim();
	}
}

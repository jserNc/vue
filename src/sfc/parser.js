/* @flow */

// ������������������Ƴ�����
import deindent from 'de-indent'
import { parseHTML } from 'compiler/parser/html-parser'
import { makeMap } from 'shared/util'

// �س�?����
const splitRE = /\r?\n/g
// . ƥ������з�����������ַ�
const replaceRE = /./g
// isSpecialTag(tag) �ж� tag �Ƿ�Ϊ script,style,template ����֮һ
const isSpecialTag = makeMap('script,style,template', true)

// flow ��������
type Attribute = {
  name: string,
  value: string
};

/**
 * Parse a single-file component (*.vue) file into an SFC Descriptor Object.
 */
export function parseComponent (
  content: string,
  options?: Object = {}
 ): SFCDescriptor {
  /*
	flow/complier �ļ�����������
	declare type SFCDescriptor = {
	  template: ?SFCBlock;
	  script: ?SFCBlock;
	  styles: Array<SFCBlock>;
	  customBlocks: Array<SFCCustomBlock>;
	}

	declare type SFCBlock = {
	  type: string;
	  content: string;
	  start?: number;
	  end?: number;
	  lang?: string;
	  src?: string;
	  scoped?: boolean;
	  module?: string | boolean;
	};

	declare type SFCCustomBlock = {
	  type: string;
	  content: string;
	  start?: number;
	  end?: number;
	  src?: string;
	  attrs: {[attribute:string]: string};
	};
  */
  const sfc: SFCDescriptor = {
    template: null,
    script: null,
    styles: [],
    customBlocks: []
  }
  let depth = 0
  let currentBlock: ?(SFCBlock | SFCCustomBlock) = null

  function start (
    tag: string,
	// attrs Ϊһ�����飬�����ÿ���� Attribute������ Attribute �ǰ��� name �� value ���ԵĶ���
    attrs: Array<Attribute>,
    unary: boolean,
    start: number,
    end: number
  ) {
	// depth === 0 ˵��֮ǰ�ı�ǩ������ˣ��ر���
    if (depth === 0) {
      currentBlock = {
        type: tag,
        content: '',
        start: end,
		/*
		  ���� arr.reduce([callback, initialValue]) ������
		  �� callback �����ĵ�һ������Ϊ�ϴε��� callback �ķ���ֵ�����߳�ʼֵ initialValue
			 callback �����ĵڶ�������Ϊ��ǰ�������Ԫ��
		  �� initialValue Ϊ��һ�ε��� callback �ĵ�һ������

		  attrs �� [{name, value},{name, value},{name, value}...] ��Ϊ {name1:value1,name2:value2,name3:value3,...}
		*/
        attrs: attrs.reduce((cumulated, { name, value }) => {
          cumulated[name] = value || true
          return cumulated
        }, Object.create(null))
      }
	  // tag Ϊ script,style,template ����֮һ
      if (isSpecialTag(tag)) {
		// ���� attrs���� currentBlock �������
        checkAttrs(currentBlock, attrs)
		// sfc.style Ĭ��Ϊ []
        if (tag === 'style') {
          sfc.styles.push(currentBlock)
		// tag Ϊ script | template��sfc[script | template] Ĭ��ֵΪ null
        } else {
          sfc[tag] = currentBlock
        }
	  // ������ǩ
      } else { // custom blocks
        sfc.customBlocks.push(currentBlock)
      }
    }
	// unary Ϊ false��������һԪ���������ô depth �� 1����ʾ��ǩ����
    if (!unary) {
      depth++
    }
  }

  /*
	type Attribute = {
	  name: string,
	  value: string
	};

	checkAttrs �����������Ǳ��� attrs���� block �������
  */
  function checkAttrs (block: SFCBlock, attrs: Array<Attribute>) {
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i]
      if (attr.name === 'lang') {
        block.lang = attr.value
      }
      if (attr.name === 'scoped') {
        block.scoped = true
      }
      if (attr.name === 'module') {
        block.module = attr.value || true
      }
      if (attr.name === 'src') {
        block.src = attr.value
      }
    }
  }

  function end (tag: string, start: number, end: number) {
	// depth === 1 ˵���б�ǩδ�ر�
    if (depth === 1 && currentBlock) {
      currentBlock.end = start
	  // ȥ��������Ȼ���ȡ���ݿ�
      let text = deindent(content.slice(currentBlock.start, currentBlock.end))
      // pad content so that linters and pre-processors can output correct
      // line numbers in errors and warnings
      if (currentBlock.type !== 'template' && options.pad) {
        text = padContent(currentBlock, options.pad) + text
      }
      currentBlock.content = text
      currentBlock = null
    }
	// depth �� 1����ʾ��ǩ�ر�
    depth--
  }

  function padContent (block: SFCBlock | SFCCustomBlock, pad: true | "line" | "space") {
    if (pad === 'space') {
      return content.slice(0, block.start).replace(replaceRE, ' ')
    } else {
      const offset = content.slice(0, block.start).split(splitRE).length
      const padChar = block.type === 'script' && !block.lang
        ? '//\n'
        : '\n'
      return Array(offset).join(padChar)
    }
  }

  parseHTML(content, {
    start,
    end
  })

  return sfc
}

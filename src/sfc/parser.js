/* @flow */

// 第三方插件，作用是移除缩进
import deindent from 'de-indent'
import { parseHTML } from 'compiler/parser/html-parser'
import { makeMap } from 'shared/util'

// 回车?换行
const splitRE = /\r?\n/g
// . 匹配除换行符以外的任意字符
const replaceRE = /./g
// isSpecialTag(tag) 判断 tag 是否为 script,style,template 三者之一
const isSpecialTag = makeMap('script,style,template', true)

// flow 类型声明
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
	flow/complier 文件中有声明：
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
	// attrs 为一个数组，数组的每项是 Attribute。其中 Attribute 是包含 name 和 value 属性的对象
    attrs: Array<Attribute>,
    unary: boolean,
    start: number,
    end: number
  ) {
	// depth === 0 说明之前的标签都配对了，关闭了
    if (depth === 0) {
      currentBlock = {
        type: tag,
        content: '',
        start: end,
		/*
		  对于 arr.reduce([callback, initialValue]) 函数：
		  ① callback 函数的第一个参数为上次调用 callback 的返回值，或者初始值 initialValue
			 callback 函数的第二个参数为当前被处理的元素
		  ② initialValue 为第一次调用 callback 的第一个参数

		  attrs 由 [{name, value},{name, value},{name, value}...] 变为 {name1:value1,name2:value2,name3:value3,...}
		*/
        attrs: attrs.reduce((cumulated, { name, value }) => {
          cumulated[name] = value || true
          return cumulated
        }, Object.create(null))
      }
	  // tag 为 script,style,template 三者之一
      if (isSpecialTag(tag)) {
		// 遍历 attrs，给 currentBlock 添加属性
        checkAttrs(currentBlock, attrs)
		// sfc.style 默认为 []
        if (tag === 'style') {
          sfc.styles.push(currentBlock)
		// tag 为 script | template，sfc[script | template] 默认值为 null
        } else {
          sfc[tag] = currentBlock
        }
	  // 其他标签
      } else { // custom blocks
        sfc.customBlocks.push(currentBlock)
      }
    }
	// unary 为 false，即不是一元运算符，那么 depth 加 1，表示标签开启
    if (!unary) {
      depth++
    }
  }

  /*
	type Attribute = {
	  name: string,
	  value: string
	};

	checkAttrs 函数的作用是遍历 attrs，给 block 添加属性
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
	// depth === 1 说明有标签未关闭
    if (depth === 1 && currentBlock) {
      currentBlock.end = start
	  // 去掉缩进，然后截取内容块
      let text = deindent(content.slice(currentBlock.start, currentBlock.end))
      // pad content so that linters and pre-processors can output correct
      // line numbers in errors and warnings
      if (currentBlock.type !== 'template' && options.pad) {
        text = padContent(currentBlock, options.pad) + text
      }
      currentBlock.content = text
      currentBlock = null
    }
	// depth 减 1，表示标签关闭
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

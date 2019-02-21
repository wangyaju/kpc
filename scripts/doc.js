const KDoc = require('kdoc');
const path = require('path');
const Vdt = require('vdt');
const webpackConfig = require('../site/webpack.config.render');
const webpackConfigClient = require('../site/webpack.config.client');
const webpack = require('webpack');
const highlight = require('highlight.js');
const intact2vue = require('./intact2vue');
const intact2react = require('./intact2react');

const languageMap = function(key) {
    const map = {
        'vue': 'html',
        'vdt': 'jsx',
    };
    return map[key] || key;
};

module.exports = function(isDev = true) {
    const hasWrittenSidebar = {};

    let _resolve;
    const promise = new Promise((resolve) => {
        _resolve = resolve;
    });
    promise.resolve = (...args) => _resolve(...args);
    const root = isDev ? 
        path.resolve(__dirname, '../site/.dist') : 
        path.resolve(__dirname, `../site/dist`);

    const doc = new KDoc(
        './@(docs|components)/**/*.md',
        // './@(docs|components)/layout/**/*.md',
        root
    );

    doc.use(KDoc.plugins.md);

    doc.use(function(ctx) {
        Vdt.setDefaults({
            disableSplitText: true,
            skipWhitespace: false,
            delimiters: ['{{', '}}']
        });

        ctx.hook.add('md.renderer', (renderer, file, codes) => {
            renderer.table = (header, body) => {
                return `<div class="k-table k-border">
                    <div class="k-table-wrapper">
                        <div class="k-thead">
                            <table>
                                <thead>${header}</thead>
                            </table>
                        </div>
                        <div class="k-tbody">
                            <table>
                                <tbody>${body}</tbody>
                            </table>
                        </div>
                    </div>
                </div>`
            };
            const codeRenderer = renderer.code;
            renderer.code = function(code, language) {
                const matches = code.match(/@file ([^\s]+)/);
                if (matches) {
                    code = code.substring(code.indexOf('\n') + 1);
                }
                const result = codeRenderer.call(this, code, language);
                if (matches) {
                    codes[codes.length - 1].file = matches[1];
                }
                if (/demos/.test(file.path)) {
                    return '';
                } else {
                    return result; 
                }
            };

            renderer.paragraph = function(text) {
                return '<p>' + text.replace(/\n/g, '') + '</p>\n';
            };

            // replace the url of path, add kpc for online built
            // const imageRenderer = renderer.image;
            // renderer.image = function(href, title, text) {
                // if (!isDev) {
                    // href = href.replace(/^\/imgs\//, '/kpc/imgs/');
                // }
                // const result = imageRenderer.call(this, href, title, text); 
                // return result;
            // }
        });

        const getBuiltPath = (p, file) => {
            const basename = path.basename(p, '.md');
            const dirname = path.dirname(p);
            if (file) file.language = 'zh-CN';
            if (basename.endsWith('.en-US')) {
                if (file) file.language = 'en-US';
                if (basename === 'index.en-US') {
                    if (file) {
                        file.componentName = path.basename(path.dirname(p));
                    }
                    return path.join(dirname + '-en', 'index.json');
                } else {
                    return path.join(dirname, basename.replace('.en-US', '-en'), 'index.json');
                }
            } else if (basename !== 'index') {
                return path.join(dirname, basename, 'index.json');
            }
            if (file) {
                file.componentName = path.basename(path.dirname(p));
            }
            return path.join(dirname, 'index.json');
        };

        ctx.hook.add('dist.before', async function(files) {
            await ctx.fsEach(async function(file, index) {
                file.path = getBuiltPath(file.path, file);
                file.extname = '.json';
                file.md.index = index;

                let hasJs = false;
                let hasStylus = false;
                let hasVue = false;
                let hasReact = false;

                // for vue
                let vueScript;
                let vueTemplate;
                let vueData;
                let vueMethods;

                // for react
                let reactMethods;

                let jsHead;

                const codes = file.md.codes = file.md.codes.filter((item, index) => {
                    if (item.example) {
                        item.content = [
                            item.content,
                            `export const example = true;`,
                        ].join('\n');
                        return true;
                    };
                    if (item.language === 'js' && !item.file) {
                        hasJs = true;
                        item.content = [
                            `import Intact from 'intact';`,
                            `import template from './index.vdt';`,
                            hasStylus ? `import './index.styl'; \n` : '',
                            item.content,
                        ].join('\n');
                    }
                    if (item.language === 'styl') hasStylus = true;
                    if (item.language === 'vue') hasVue = true;
                    if (item.language === 'jsx') hasReact = true;
                    if (item.language === 'vue-script') {
                        vueScript = item.content;
                        return false;
                    }
                    if (item.language === 'vue-template') {
                        vueTemplate = item.content;
                        return false;
                    }
                    if (item.language === 'vue-data') {
                        vueData = item.content;
                        return false;
                    }
                    if (item.language === 'vue-methods') {
                        vueMethods = item.content;
                        return false;
                    }
                    if (item.language === 'react-methods') {
                        reactMethods = item.content;
                        return false;
                    }
                    if (item.language === 'js-head') {
                        jsHead = item.content;
                        return false;
                    }
                    if (item.language === 'vue-ignore') {
                        item.language = 'vue';
                        item.ignored = true;
                        hasVue = true;
                    }
                    if (item.language === 'react-ignore') {
                        item.language = 'jsx';
                        item.ignored = true;
                        hasReact = true;
                    }
                    return true;
                });

                if (!hasJs) {
                    codes.splice(hasStylus ? 2 : 1, 0, {
                        language: 'js',
                        content: [
                            `import Intact from 'intact';`,
                            `import template from './index.vdt';`,
                            hasStylus ? `import './index.styl'; \n` : '',
                            `export default class extends Intact {`,
                            `    @Intact.template()`,
                            `    static template = template;`,
                            `}`,
                        ].join('\n')
                    });
                }

                const data = Object.assign({}, file.md, {
                    sideBars: file.sideBars,
                });

                if (/demos/.test(file.path)) {
                    // ignore App component
                    if (!/\/app\//.test(file.path)) {
                        const vdt = codes[0].content;
                        const js = hasJs ? codes[hasStylus ? 2 : 1].content : null;

                        if (!hasVue) {
                            const code = {
                                language: 'vue',
                                content: intact2vue(vdt, js, vueScript, vueTemplate, vueMethods, vueData, jsHead)
                            };
                            if (!hasReact) {
                                codes.push(code);
                            } else {
                                codes.splice(codes.length - 1, 0, code);
                            }
                        }

                        if (!hasReact) {
                            codes.push({
                                language: 'jsx',
                                content: intact2react(vdt, js, reactMethods, jsHead), 
                            });
                        }
                    }

                    data.highlighted = codes.map(item => {
                        return {
                            language: item.language,
                            content: `<pre><code class="hljs ${languageMap(item.language)}">` +
                                highlight.highlight(languageMap(item.language), item.content).value +
                            `</code></pre>`,
                            file: item.file,
                        };
                    });
                    delete data.catalogs;

                    const headingReg = /<h2[^>]*>([\w\-]*)<\/h2>(((?!<h2)[\s\S])*)/g;
                    const contents = {};
                    data.contents.replace(headingReg, function(nouse, language, text) {
                        contents[language] = text;
                    });
                    if (!Object.keys(contents).length) {
                        contents['zh-CN'] = data.contents;
                    }
                    data._contents = data.contents;
                    data.contents = contents;
                }

                delete data.source;
                // remove redundant data
                const _data = JSON.parse(JSON.stringify(data));
                delete _data.codes;

                const sidebar = data.setting && data.setting.sidebar;
                if (sidebar && !hasWrittenSidebar[sidebar]) {
                    const sideBars = {};
                    for (let key in data.sideBars) {
                        sideBars[key] = [];
                        for (let i = 0; i < data.sideBars[key].length; i++) {
                            const item = data.sideBars[key][i];
                            delete item.children;
                            item.url = '/' + getBuiltPath(item.path).replace('index.json', '');
                            sideBars[key].push(item);
                        }
                    }
                    await ctx.fsWrite(path.join(root, `${sidebar}.json`), JSON.stringify(sideBars, null, 4));
                    hasWrittenSidebar[sidebar] = true;
                }
                delete _data.sideBars;

                file.contents = new Buffer(JSON.stringify(_data, null, 4));
            });
        });

        ctx.hook.add('dist.after', async files => {
            await ctx.fsEach(async function(file) {
                if (/demos/.test(file.path)) {
                    const iframe = file.md.setting.iframe;
                    await file.md.codes.forEach(async item => {
                        if (item.ignored) return;
                        file.extname = '.' + item.language;
                        let content = item.content;
                        if (item.language === 'js' && !item.file) {
                            if (!iframe) {
                                content = [
                                    `export {default as data} from './index.json';`,
                                    item.content,
                                ].join('\n');
                            } else {
                                content = item.content;
                            }
                        } else if (item.language === 'styl' && !item.file) {
                            // if (!iframe) {
                                content = [
                                    `.example.index-${file.md.index}`,
                                    ...content.split('\n').map(line => `    ${line}`)
                                ].join('\n');
                            // }
                        }
                        await ctx.fsWrite(!item.file ? file.relative : file.dirname + '/' + item.file, content);
                    });
                    if (iframe) {
                        file.url = file.dirname.replace(root, '');
                        await ctx.fsWrite(file.dirname + '/demo.js', [
                            `export {default as data} from './index.json';`,
                            `import Intact from 'intact';`,
                            ``,
                            `export default class extends Intact {`,
                            `    @Intact.template()`,
                            `    static template = '<div class="browser-mockup"><iframe height="${iframe}" src="${file.url}/index.html"></iframe></div>';`,
                            `}`,
                        ].join('\n'));
                        
                        await ctx.fsWrite(file.dirname + '/iframe.js', [
                            `import Intact from 'intact';`,
                            `import Demo from './index.js';`,
                            `Intact.mount(Demo, document.getElementById('page'));`,
                        ].join('\n'));

                        await ctx.fsWrite(
                            file.dirname + '/index.html',
                            Vdt.renderFile(path.resolve(__dirname, '../site/src/iframe.vdt'), {
                                script: file.url + '/bundle.js',
                                index: file.md.index,
                            })
                        );
                    }
                } else {
                    file.extname = '.js';
                    if (!file.md.setting) return;

                    // generate example demo file
                    let index = 0;
                    file.md.codes.forEach(async item => {
                        if (item.example) {
                            await ctx.fsWrite(
                                path.join(file.dirname, `demos/demo${index++}/index.js`),
                                item.content
                            );
                        }
                    });

                    const sidebar = file.md.setting.sidebar;
                    await ctx.fsWrite(
                        file.relative,
                        [
                            `import Article from '~/../src/components/article';`,
                            `import data from './index.json';`,
                            sidebar ? `import sidebar from '~/${sidebar}.json';` : undefined,
                            ``,
                            file.componentName ? [
                                `const r = require.context('${file.language === 'en-US' ? '../' + file.componentName : './'}', true, /demos.*(index|demo).js$/);`,
                                `const keys = r.keys();`,
                                `const demos = [];`,
                                `for (let i = 0; i < keys.length; i++) {`,
                                `    const file = keys[i];`,
                                `    // if we found demo.js then ignore index.js`,
                                `    if (/demo\.js$/.test(file)) i++;`,
                                `    demos.push(r(file));`,
                                `}`,
                            ].join('\n') : `const demos = [];`,
                            ``,
                            `export default class extends Article {`,
                            sidebar ? `    static sidebar = sidebar;` : undefined,
                            `    static data = data;`,
                            `    static language = '${file.language}';`,
                            `    defaults() {`,
                            `        return {...super.defaults(), ...data, demos};`,
                            `    }`,
                            `}`,
                        ].join('\n')
                    );
                }
            });

            // 静态化
            const iframes = [];
            if (isDev) {
                await ctx.fsEach(async function(file) {
                    if (!/demos/.test(file.path)) {
                        file.extname = '.html';
                        await ctx.fsWrite(
                            file.relative,
                            Vdt.renderFile(path.resolve(__dirname, '../site/src/index.vdt'))
                        );
                    } else if (file.md.setting.iframe) {
                        iframes.push({
                            [file.url.substring(1) + '/bundle']: file.dirname + '/iframe.js',
                        });
                    }
                });

                promise.resolve({iframes});
            } else {
                const compiler = webpack(webpackConfig()); 
                compiler.run(async (err, stats) => {
                    console.log(stats.toString({
                        colors: true 
                    }));
                    delete require.cache[require.resolve('../site/dist/render')];
                    const render = require('../site/dist/render').default;

                    await ctx.fsEach(async function(file) {
                        if (!/demos/.test(file.path)) {
                            file.extname = '.html';
                            const pathname = path.relative(ctx.data.output, file.path).replace('index.html', '').replace('\\', '/');
                            const data = await render(`/${pathname}`);
                            await ctx.fsWrite(
                                file.relative, 
                                Vdt.renderFile(path.resolve(__dirname, '../site/src/index.vdt'), {
                                    title: file.md.setting.title,
                                    content: data.content,
                                    style: data.style,
                                })
                            );
                        } else if (file.md.setting.iframe) {
                            iframes.push({
                                [file.url.substring(1) + '/bundle']: file.dirname + '/iframe.js'
                            });
                        }
                    });

                    promise.resolve({render, iframes});
                });
            }
        });
    });

    doc.run(); 

    return promise;
};

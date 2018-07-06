export {default as data} from './index.json';
import Intact from 'intact';
import template from './index.vdt';

export default class extends Intact {
    @Intact.template()
    static template = template;

    defaults() {
        return {
            data: [
                {
                    value: 'beijing',
                    label: '北京',
                    children: []
                },
                {
                    value: 'hunan',
                    label: '湖南',
                    children: []
                }
            ]
        };
    }

    loadData(item) {
        return new Promise(resolve => {
            setTimeout(() => {
                switch (item.value) {
                    case 'beijing':
                        item.children = [
                            {
                                value: 'haidian',
                                label: '海淀区'
                            },
                            {
                                value: 'chaoyang',
                                label: '朝阳区'
                            },
                            {
                                value: 'fengtai',
                                label: '丰台区'
                            }
                        ];
                        break;
                    case 'hunan':
                        item.children = [
                            {
                                value: 'changsha',
                                label: '长沙市',
                                children: [
                                    {
                                        value: 'yuelu',
                                        label: '岳麓区',
                                    }
                                ]
                            },
                            {
                                value: 'yueyang',
                                label: '岳阳市',
                                children: []
                            }
                        ];
                        break;
                    case 'yueyang':
                        item.children = [
                            {
                                value: 'yueyanglou',
                                label: '岳阳楼区',
                            },
                            {
                                value: 'yueyangxian',
                                label: '岳阳县',
                            }
                        ];
                        break;
                }

                resolve();
            }, 1000);
        });
    }
}
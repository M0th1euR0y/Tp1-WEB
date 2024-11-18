import Model from './model.js';

export default class Post extends Model {
    constructor() {
        super(true);

        this.addField('Title', 'string');
        this.addField('Text', 'string');
        this.addField('Category', 'string');
        this.addField('Image', 'asset');
        this.addField('Creation', 'integer');

        this.setKey("Id");
    }
}
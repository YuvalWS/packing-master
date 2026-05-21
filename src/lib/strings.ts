import data from './strings.json' with { type: 'json' };

export type Strings = typeof data;

const strings: Strings = data;

export default strings;

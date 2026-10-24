import {type FullTranslationCatalogEntry} from './full-reference-translation-model';

export type SupplementalTranslation=FullTranslationCatalogEntry&{label:string;sourceType:'pdf'|'html';kind:string;originalAsset?:string;coverageNote?:string;pageSizes?:{page:number;width:number;height:number}[]};
export function supplementalTranslations(value:unknown,referenceId:string):SupplementalTranslation[]{
 if(!value||typeof value!=='object')return [];
 const catalog=value as {schemaVersion?:unknown;supplements?:unknown};
 if(catalog.schemaVersion!==1||!Array.isArray(catalog.supplements))return [];
 return catalog.supplements.filter((entry):entry is SupplementalTranslation=>!!entry&&entry.referenceId===referenceId&&typeof entry.sourceSha256==='string'&&/^[a-f0-9]{64}$/.test(entry.sourceSha256)&&entry.sourceId==='supplement-'+entry.sourceSha256.slice(0,20)&&Number.isInteger(entry.pageCount)&&entry.pageCount>0&&entry.asset===`translations/${entry.sourceSha256}/pages.json`&&typeof entry.label==='string'&&typeof entry.kind==='string'&&['pdf','html'].includes(entry.sourceType)&&(entry.sourceType!=='pdf'||entry.originalAsset===`translations/${entry.sourceSha256}/original.pdf`));
}

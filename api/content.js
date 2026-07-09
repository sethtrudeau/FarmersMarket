'use strict';

const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// In-memory cache between warm serverless invocations
let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000; // 5 minutes

function prop(page, name) {
  const p = page.properties[name];
  if (!p) return null;
  switch (p.type) {
    case 'title':     return p.title.map(t => t.plain_text).join('') || null;
    case 'rich_text': return p.rich_text.map(t => t.plain_text).join('') || null;
    case 'number':    return p.number;
    case 'url':       return p.url || null;
    default:          return null;
  }
}

// Converts a Notion rich_text array to an HTML string, preserving
// bold, italic, underline, strikethrough, code, and newlines.
function richProp(page, name) {
  const p = page.properties[name];
  if (!p) return null;
  const blocks = p.type === 'title' ? p.title : p.type === 'rich_text' ? p.rich_text : [];
  if (!blocks.length) return null;

  return blocks.map(block => {
    let text = block.plain_text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    const a = block.annotations;
    if (a.code)          text = `<code>${text}</code>`;
    if (a.bold)          text = `<strong>${text}</strong>`;
    if (a.italic)        text = `<em>${text}</em>`;
    if (a.strikethrough) text = `<s>${text}</s>`;
    if (a.underline)     text = `<u>${text}</u>`;
    return text;
  }).join('') || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  if (_cache && Date.now() - _cacheAt < CACHE_MS) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(_cache);
  }

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      sorts: [{ property: 'Number', direction: 'ascending' }],
    });

    const sections = response.results.map(page => ({
      number:           prop(page, 'Number'),
      title:            prop(page, 'Title'),
      headline:         richProp(page, 'Headline'),
      description:      richProp(page, 'Description'),
      cardTagline:      richProp(page, 'CardTagline'),
      accentColor:      prop(page, 'AccentColor'),
      videoEmbed:       prop(page, 'VideoEmbed'),
      videoDescription: prop(page, 'VideoDescription'),
      playlabEmbed:     prop(page, 'PlaylabEmbed'),
      resourceLink1:    prop(page, 'ResourceLink1'),
      resourceName1:    prop(page, 'ResourceName1'),
      resourceLink2:    prop(page, 'ResourceLink2'),
      resourceName2:    prop(page, 'ResourceName2'),
    }));

    _cache = { sections };
    _cacheAt = Date.now();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json({ sections });
  } catch (err) {
    console.error('[notion] API error:', err);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
};

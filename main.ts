import { App, Editor, MarkdownView, LinkCache, getLinkpath, parseLinktext, CachedMetadata, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		})
		this.addCommand({
			id: 'inline-link-under-cursor',
			name: 'Inline link under cursor',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const file = view.file;
				if (!file) return;
				const metadata = this.app.metadataCache.getFileCache(file);
				const cursor = editor.getCursor();
				const link = metadata?.links?.find(l => {
					const p = l.position;
					return p.end.line == cursor.line
						&& p.start.line == cursor.line
						&& p.start.col <= cursor.ch
						&& p.end.col >= cursor.ch;
				});

				console.log(view);
				console.log(view.getViewData());
				console.log(file);
				console.log(metadata);
				console.log(cursor);
				console.log(link);

				if (!link) return;

				this.inlineLink(link, file.path, editor).then();
			}
		});

		this.addCommand({
			id: 'inline-all-links',
			name: 'Inline all links',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const file = view.file;
				if (!file) return;
				const md = this.app.metadataCache.getFileCache(file);
				const links = md?.links;

				console.log(links);

				links
					?.sort((a, b) => b.position.start.offset - a.position.start.offset)
					.forEach(l => this.inlineLink(l, file.path, editor).then());
			}
		});

		// does not work
		this.addCommand({
			id: 'inline-all-links-rec',
			name: 'Inline all links recursively',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const inlined: string[] = [];
				const file = () => view.file;
				const path = file()?.path;
				if (!path) return;
				const links = () => {
					const f = file();
					if (!f) return null;
					const md = this.app.metadataCache.getFileCache(f);
					return md?.links;
				};
				let uninlined = links();
				console.log("uninlined", uninlined);
				let i = 0;
				while (uninlined?.length && i < 3) {
					i++;
					const sortedLinks = uninlined.sort((a, b) => b.position.start.offset - a.position.start.offset);
					for (const l of sortedLinks) {
						console.log("link", l.link);
						await this.inlineLink(l, path, editor, true);
						inlined.push(l.link);
						console.log("inlined", inlined);
					}
					console.log("links", links());
					uninlined = links()?.filter(l => !inlined.includes(l.link));
					console.log("uninlined", uninlined);
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async inlineLink(link: LinkCache, sourcePath: string, editor: Editor, escapeTags: boolean = false) {
		console.log(link.link);
		const path = getLinkpath(link.link);
		console.log(path);
		const file = this.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
		console.log(file);
		if (!file) return;

		const metadata = this.app.metadataCache.getFileCache(file);
		if (!metadata) return;

		const content = await this.app.vault.read(file);
		console.log(content);

		// const cb = "```";
		const cb = "";
		const opTag = `<inline-note note='${file.name}' title='${metadata.frontmatter?.title}' path='${path}'>`;
		const edTag = `</inline-note>`;
		const esc = escapeTags ? '\\' : '';

		editor.replaceRange(
			`\n${esc}${opTag}\n${cb}${content}${cb}\n${esc}${edTag}\n`,
			{
				line: link.position.start.line,
				ch: link.position.start.col
			},
			{
				line: link.position.end.line,
				ch: link.position.end.col
			}
		);
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

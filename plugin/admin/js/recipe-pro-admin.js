(function( $ ) {
	'use strict';

	$(function() {
		var container = $('#recipe-pro-admin-container');
		if (!container.length) {
			return;
		}
		var outputContainer = $('#recipe-pro-admin-container-output');
		if (!container.length) {
			return;
		}
		var generateUUID = function (){
			var d = new Date().getTime();
			if(window.performance && typeof window.performance.now === "function"){
				d += performance.now(); //use high-precision timer if available
			}
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = (d + Math.random()*16)%16 | 0;
				d = Math.floor(d/16);
				return (c=='x' ? r : (r&0x3|0x8)).toString(16);
			});
		};
		var Ingredient = Backbone.Model.extend({
			defaults : {
				quantity: 0,
				unit: 'cup',
				name : 'carrot',
				description: ''
			}
		});
		var Ingredients = Backbone.Collection.extend({
			model: Ingredient
		});
		var BaseNestedModel = Backbone.Model.extend({
			blacklist: [],
			model: {},
			parse: function(response) {
				for(var key in this.model)
				{
					var embeddedClass = this.model[key];
					var embeddedData = response[key];
					response[key] = new embeddedClass(embeddedData, {parse:true});
				}
				return response;
			}
		});
		BaseNestedModel.prototype.toJSON = function() {
			if (this._isSerializing) {
				return this.id || this.cid;
			}
			this._isSerializing = true;
			var json = _.clone(this.attributes);
			_.each(json, function(value, name) {
				_.isFunction(value.toJSON) && (json[name] = value.toJSON());
			});
			this._isSerializing = false;
			return json;
		};
		var Recipe = BaseNestedModel.extend({
			blacklist: ['currentTab'],
			model: {
				ingredients: Ingredients
			},
			defaults: {
				currentTab: 'recipe-pro-tab-overview',
				title : 'my cool recipe',
				missingShortcode: false,
				shortCodeMessage: ''
			},
			urlRoot: ajaxurl + '?action=recipepro_recipe&postid=',
			ingestIngredients: function(ingredientDocument) {
				var target = this.get('ingredients');
				target.reset();
				var extracted = $(ingredientDocument).children('p').each(function(){
					target.add(new Ingredient({id: generateUUID(), description: $(this).text()}));
				});
				console.log("done");
			},
			disableForMissingShortcode: function(removed) {
				if (removed) {
					this.set({missingShortcode:true, shortCodeMessage: "Oops it looks like the Recipe Pro shortcode is missing from the main editor. Click the carrot icon to re-add it."});
				} else {
					this.set({missingShortcode:true, shortCodeMessage: "To begin entering your recipe please add a Recipe Pro shortcode by clicking the carrot icon in the main editor."});
				}
			},
			enableForFoundShortcode: function() {
				this.set({missingShortcode: false});
			}
		});
		var recipe = new Recipe({id: container.attr('data-post')});
		recipe.fetch();
		window.RecipePro = {
			currentRecipe: recipe
		};
		var RecipeViewModelEmitter = Backbone.View.extend({
			initialize: function(){
				_.bindAll(this, "render");
				this.model.bind('change', this.render);
			},
			render: function() {
				var jsonable = this.model.toJSON();
				jsonable['doc'] = JSON.stringify(_.omit(jsonable, this.model.blacklist));
				this.$el.html(this.template(jsonable));
				return this;
			},
			template: _.template( $('#recipe-pro-recipe-output-template').html() )
		});
		var RecipeView = Backbone.View.extend({
			events: {
				"click .recipe-pro-tab-button": "tabClick",
				"change input" : "change"
			},
			initialize: function(){
				_.bindAll(this, "render");
				//this.model.bind('sync', this.render);
				//this.render();
				this.listenToOnce(this.model, 'change', this.render);
				this.model.on("change:missingShortcode", function() {this.render()}.bind(this));
			},
			setupImage: function(jQuery) {
				// Uploading files
				var file_frame;
				var wp_media_post_id = wp.media.model.settings.post.id; // Store the old id
				var set_to_post_id = 1; // Set this
				jQuery('#upload_image_button').on('click', function( event ){
					event.preventDefault();
					// If the media frame already exists, reopen it.
					if ( file_frame ) {
						// Set the post ID to what we want
						file_frame.uploader.uploader.param( 'post_id', set_to_post_id );
						// Open frame
						file_frame.open();
						return;
					} else {
						// Set the wp.media post id so the uploader grabs the ID we want when initialised
						wp.media.model.settings.post.id = set_to_post_id;
					}
					// Create the media frame.
					file_frame = wp.media.frames.file_frame = wp.media({
						title: 'Select a image to upload',
						button: {
							text: 'Use this image',
						},
						multiple: false	// Set to true to allow multiple files to be selected
					});
					// When an image is selected, run a callback.
					file_frame.on( 'select', function() {
						// We set multiple to false so only get one image from the uploader
						var attachment = file_frame.state().get('selection').first().toJSON();
						// Do something with attachment.id and/or attachment.url here
						this.model.set('imageUrl', attachment.url);
						$( '#image-preview' ).attr( 'src', attachment.url ).css( 'width', 'auto' );
						//$( '#image_attachment_id' ).val( attachment.id );
						// Restore the main post ID
						wp.media.model.settings.post.id = wp_media_post_id;

					}.bind(this));
						// Finally, open the modal
						file_frame.open();
				}.bind(this));
				// Restore the main ID when the add media button is pressed
				jQuery( 'a.add_media' ).on( 'click', function() {
					wp.media.model.settings.post.id = wp_media_post_id;
				});
			},
			render: function() {
				var jsonable = this.model.toJSON();
				this.$el.html(this.template(jsonable));
				this.setupImage($);
				return this;
			},
			tabClick: function (e) {
				var toggleTo = $(e.currentTarget).parent().attr('for');
				if (this.model.get('currentTab') == 'recipe-pro-tab-ingredient') {
					tinyMCE.EditorManager.remove('#recipe-pro-editor-ingredient');
				}
				if (this.model.get('currentTab') == 'recipe-pro-tab-instruction') {
					tinyMCE.EditorManager.remove('#recipe-pro-editor-instruction');
				}
				this.model.set({'currentTab': toggleTo});
				this.render();
				if (toggleTo == 'recipe-pro-tab-ingredient') {
					tinyMCEPreInit.mceInit['recipe-pro-editor-ingredient'].init_instance_callback = function(editor) {
						var content = "";
						this.model.get('ingredientSections').forEach(function(section) {
							content += '<h4>' + section.name + '</h4>';
							section.items.forEach(function(item){
								content += '<p>' + item.description + '</p>';
							});
						});
						editor.setContent(content);
					}.bind(this);
					tinyMCE.init(tinyMCEPreInit.mceInit['recipe-pro-editor-ingredient']);
				}
				if (toggleTo == 'recipe-pro-tab-instruction') {
					tinyMCEPreInit.mceInit['recipe-pro-editor-instruction'].init_instance_callback = function(editor) {
						var content = "";
						this.model.get('instructions').forEach(function(inst) {
							content += '<p>' + inst.description + '</p>';
						});
						editor.setContent(content);
					}.bind(this);
					tinyMCE.init(tinyMCEPreInit.mceInit['recipe-pro-editor-instruction']);
				}

				//$('#' + toggleTo).show().siblings('.recipe-pro-tab').hide();
			},
			change : function(e) {
				var element = $(e.currentTarget);
				var input = element.val();
				var name = element.attr('name');
				if ( input !== this.model.get( name ) ) {
					this.model.set(name, input);
				}
				return true;
			},
			template: _.template( $('#recipe-pro-recipe-template').html() )
		});
		new RecipeView({
			model: recipe,
			el: container
		});
		new RecipeViewModelEmitter({
			model: recipe,
			el: outputContainer
		});
	});
})( jQuery );



//Utiliser utilities, demander a chourot comment le joindre car j'y arrive pas.
const periodicRefreshPeriod = 10;
let categories = [];
let search = "";
let selectedCategory = "";
let currentETag = "";
let hold_Periodic_Refresh = false;
let pageManager;
let itemLayout;
let endOfData = false;
let waiting = null;
let waitingGifTrigger = 2000;

Init_UI();

async function Init_UI() {
    let postItemLayout = {
        width: $("#sample").outerWidth(),
        height: $("#sample").outerHeight()
    };

    currentETag = await Posts_API.HEAD();
    pageManager = new PageManager('scrollPanel', 'postsPanel', postItemLayout, renderPosts);
    compileCategories();
    $('#aboutContainer').hide();
    $("#errorContainer").hide();
    $("#actionTitle").text("Liste des publications");

    $('#createPost').on("click", async function () {
        renderCreatePostForm();
    });
    $('#abort').on("click", async function () {
        showPosts();
    });
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    $('#searchBttn').on('click', () => {
        doSearch();
    });
    showPosts();
    start_Periodic_Refresh();

}
function doSearch() {
    search = $("#postFilter").val().trim().replaceAll(' ', ',');
    pageManager.reset();
}
function showPosts() {
    $("#actionTitle").text("Liste des publications");
    $("#scrollPanel").show();
    $('#abort').hide();
    $('#postForm').hide();
    $('#aboutContainer').hide();
    $("#createPost").show();
    hideSearch(false);
    hold_Periodic_Refresh = false;
}
function hidePosts() {
    $("#scrollPanel").hide();
    $("#createPost").hide();
    $("#abort").show();
    hold_Periodic_Refresh = true;
}
function start_Periodic_Refresh() {
    setInterval(async () => {
        if (!hold_Periodic_Refresh) {
            let etag = await Posts_API.HEAD();
            if (currentETag != etag) {
                currentETag = etag;
                await pageManager.update(false);
                compileCategories();
            }
        }
    },
        periodicRefreshPeriod * 1000);
}
function renderAbout() {
    hidePosts();
    hideSearch(true);
    $("#actionTitle").text("À propos...");
    $("#aboutContainer").show();
}
function updateDropDownMenu() {
    let DDMenu = $("#DDMenu");
    let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
    DDMenu.empty();
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `));
    DDMenu.append($(`<div class="dropdown-divider"></div>`));
    categories.forEach(category => {
        selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
        DDMenu.append($(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `));
    })
    DDMenu.append($(`<div class="dropdown-divider"></div> `));
    DDMenu.append($(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `));
    $('#aboutCmd').on("click", function () {
        renderAbout();
    });
    $('#allCatCmd').on("click", function () {
        showPosts();
        selectedCategory = "";
        updateDropDownMenu();
        pageManager.reset();
    });
    $('.category').on("click", function () {
        showPosts();
        selectedCategory = $(this).text().trim();
        updateDropDownMenu();
        pageManager.reset();
    });
}
async function renderPosts(queryString) {
    $("#actionTitle").text("Liste des publications");
    queryString += '&sort=Creation,desc';
    if (search != "") queryString += "&keywords=" + search;
    if (selectedCategory != "") queryString += "&category=" + selectedCategory;
    addWaitingGif();
    let endOfData = false;
    let response = await Posts_API.GetQuery(queryString);
    if (!Posts_API.error) {
        currentETag = response.ETag;
        let Posts = response.data;
        if (Posts.length > 0) {
            Posts.forEach(Post => {
                if ((selectedCategory === "") || (selectedCategory === Post.Category))
                    $("#postsPanel").append(renderPost(Post));
            });
            $(".editCmd").off();
            $(".editCmd").on("click", function () {
                renderEditPostForm($(this).attr("editpostId"));
            });
            $(".deleteCmd").off();
            $(".deleteCmd").on("click", function () {
                renderDeletePostForm($(this).attr("deletepostId"));
            });
            descriptionListener();
        }
        else {
            endOfData = true;
        }
    }
    else {
        renderError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
    return endOfData;
}
function addWaitingGif() {
    clearTimeout(waiting);
    waiting = setTimeout(() => {
        $("#postsPanel").append($("<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>"));
    }, waitingGifTrigger)
}
function removeWaitingGif() {
    clearTimeout(waiting);
    $("#waitingGif").remove();
}
function hideSearch(hide) {
    if (hide)
        $("#filterContainer").hide();
    else
        $("#filterContainer").show();
}
function renderError(message) {
    removeWaitingGif();
    hidePosts();
    hideSearch(true);
    $("#scrollPanel").hide();
    $(".headerOptions").hide();
    $("#actionTitle").text("Erreur du serveur...");
    $("#errorContainer").show();
    $("#errorContainer").empty();
    $("#errorContainer").append(
        $(`
            <span class="errorContainer">
                ${message}
            </span>
        `)
    );
}
function renderCreatePostForm() {
    renderPostForm();
}
async function renderEditPostForm(id) {
    addWaitingGif();
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null)
            renderPostForm(Post);
        else
            renderError("Publication introuvable!");
    } else {
        renderError(Posts_API.currentHttpError);
    }
    removeWaitingGif();
}
async function renderDeletePostForm(id) {
    hidePosts();
    hideSearch(true);
    $("#createPost").hide();
    $("#abort").show();
    $('#filterContainer').hide();
    $("#actionTitle").text("Retrait");
    let response = await Posts_API.Get(id)
    if (!Posts_API.error) {
        let Post = response.data;
        if (Post !== null) {
            $("#postForm").show();
            $("#postForm").empty();
            $("#postForm").append(`
            <div class="PostdeleteForm">
                <h4>Effacer la publication suivante?</h4>
                <hr/>
                ${renderPost(Post, true).html()}
                <br>
                <div class="formButtons">
                    <input type="button" value="Effacer" id="deletePost" class="btn btn-primary">
                    <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
                </div>
            </div>    
            `);
            $('#deletePost').on("click", async function () {
                await Posts_API.Delete(Post.Id);
                if (!Posts_API.error) {
                    showPosts();
                    await pageManager.update(false);
                    compileCategories();
                }
                else {
                    console.log(Bookmarks_API.currentHttpError)
                    renderError("Une erreur est survenue!");
                }
            });
            $('#cancel').on("click", function () {
                showPosts();
                $('#filterContainer').show();
            });
        }
        else
            renderError("Publication introuvable!");
    }
    else
        renderError(Posts_API.currentHttpError);
}
function getFormData($form) {
    const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
    var jsonObject = {};
    $.each($form.serializeArray(), (index, control) => {
        jsonObject[control.name] = control.value.replace(removeTag, "");
    });
    console.log(jsonObject);
    return jsonObject;
}
function newPost() {
    Post = {};
    Post.Id = "";
    Post.Title = "";
    Post.Text = "";
    Post.Category = "";
    Post.Image = "";
    Post.Creation = nowInSeconds();
    return Post;
}
function renderPostForm(Post = null) {
    hidePosts();
    hideSearch(true);
    let create = Post == null;
    if (create) {
        Post = newPost();
        Post.Image = "images/no-post.jpg";
    }
    $("#actionTitle").text(create ? "Création" : "Modification");
    $("#postForm").show();
    $("#postForm").empty();
    $("#postForm").append(`
        <form class="form" id="PostForm">
            <input type="hidden" name="Id" value="${Post.Id}"/>
            <input type="hidden" name="Creation" value="${Post.Creation}"/>

            <label for="Title" class="form-label">Titre: </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${Post.Title}"
            />
            <label for="Text" class="form-label">Description: </label>
            <textarea
                class="form-control Alpha"
                name="Text"
                id="Text"
                placeholder="Description"
                required>${Post.Text}</textarea>
            <label for="Category" class="form-label">Catégorie: </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${Post.Category}"
            />
            <!-- nécessite le fichier javascript 'imageControl.js' -->
            <label class="form-label">Photo: </label>
            <div class='imageUploader'
                newImage='${create}' 
                controlId='Image' 
                imageSrc='${Post.Image}' 
                waitingImage="Loading_icon.gif"
                style="cursor:pointer;">
            </div>
            <br>
            <div style="display:flex;justify-content: center; gap: 5px;">
                <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary">
                <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
            </div>
        </form>
    `);
    initImageUploaders();
    initFormValidation();
    $('#PostForm').on("submit", async function (event) {
        event.preventDefault();
        let Post = getFormData($("#PostForm"));
        Post.Title = capitalizeFirstLetter(Post.Title);
        Post.Text = capitalizeFirstLetter(Post.Text);
        Post.Category = capitalizeFirstLetter(Post.Category);
        Post = await Posts_API.Save(Post, create);
        if (!Posts_API.error) {
            showPosts();
            await pageManager.update(false);
            compileCategories();
            pageManager.scrollToElem(Post.Id);
        }
        else
            renderError("Une erreur est survenue!");
    });
    $('#cancel').on("click", function () {
        showPosts();
    });
}
async function compileCategories() {
    categories = [];
    let response = await Posts_API.GetQuery("?fields=category&sort=category");
    if (!Posts_API.error) {
        let items = response.data;
        if (items != null) {
            items.forEach(item => {
                if (!categories.includes(item.Category))
                    categories.push(item.Category);
            })
            updateDropDownMenu();
        }
    }
}
function renderPost(Post, hideOptions = false) {
    //Temporary
    return $(`
    <div class="postContainer" id="${Post.Id}">
        <div class="post noselect">
            <div class="postHeader">
                <div class="postCategory ${Post.Category}">${Post.Category}</div>
                <div class="PostCommandPanel" ${!hideOptions ? "" : "hidden"}>
                    <span class="editCmd cmdIcon fa-solid fa-pen" editPostId="${Post.Id}" title="Modifier ${Post.Title}"></span>
                    <span class="deleteCmd cmdIcon fa-solid fa-trash" deletePostId="${Post.Id}" title="Effacer ${Post.Title}"></span>
                </div>
            </div>
            <div class="postTitle">${Post.Title}</div>
            <div class="postImgContainer"><img src="${Post.Image}" class="postImg" alt="Image de la publication"/></div>
            <div class="postDate">${secondsToDateString(Post.Creation)}</div>
            <div class="postDescription">${Post.Text.replaceAll('\n', '<br>')}</div>
            <div class="seeMore" id="more_${Post.Id}">
                <span>Voir plus...</span>
                <i class="fa fa-chevron-circle-down" aria-hidden="true"></i>
            <div>
        </div>
    </div>           
    `);
}
function descriptionListener(){
    $('.seeMore').on('click', function () {
        let description = $(this).prev();
        $(description).toggleClass('more');
        let txt = $(this).children().first().text();
        console.log(txt);
        $(this).children().first().text(txt.includes('plus') ? 'Voir moins' : 'Voir plus...');
        $(this).children().eq(1).toggleClass('fa-chevron-circle-down fa-chevron-circle-up');
    });
}
function capitalizeFirstLetter(s) {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function secondsToDateString(dateInSeconds, localizationId = 'fr-FR') {
    const hoursOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
    return new Date(dateInSeconds * 1000).toLocaleDateString(localizationId, hoursOptions);
}
const nowInSeconds = () => {
    const now = new Date();
    return Math.round(now.getTime() / 1000);
}
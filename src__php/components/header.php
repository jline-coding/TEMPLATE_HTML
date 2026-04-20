<header class="c-header">
    <div class="c-header__inner">  
        <?php if(isset($page) && $page === 'top'): ?><h1 class="c-header__logo"><?php else: ?><div class="c-header__logo"><?php endif; ?> 
            <a href="" class="c-header__logo__link">
                logo123
            </a>
            <span class="c-header__logo__caption">SITE</span>
        <?php if(isset($page) && $page === 'top'): ?></h1><?php else: ?></div><?php endif; ?> 
        
        <div class="c-header__btn">
            <a href="" class="c-btn">btn</a>
        </div>
    </div>
    <div class="c-toggle">
        <span class="c-toggle__line"></span>
        <span class="c-toggle__txt">MENU</span>
    </div>
</header>
<!--▲ Content area ▲-->
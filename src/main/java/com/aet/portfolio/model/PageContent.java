package com.aet.portfolio.model;

import java.util.ArrayList;
import java.util.List;

public class PageContent {
    private String title;
    private String content;
    private String border;

    public PageContent() {
    }

    public PageContent(String title, String content, String border) {
        this.title = title;
        this.content = content;
        this.border = border;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getBorder() {
        return border;
    }

    public void setBorder(String border) {
        this.border = border;
    }
}
